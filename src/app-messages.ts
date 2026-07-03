import {
  SimplePool,
  finalizeEvent,
  getPublicKey,
  type Event,
  type EventTemplate,
  type UnsignedEvent,
} from "nostr-tools";

import { decryptContent, encryptContent } from "./crypto.js";
import {
  ECS_APP_MESSAGE_KIND,
  ECS_APP_MESSAGE_PROTOCOL,
  ECS_APP_MESSAGE_VERSION,
  type EcsAppMessage,
  type EcsAppMessageEnvelope,
  type EcsAppMessageOptions,
  type PendingSubscriptionInvoiceRequest,
  type SendEcsAppMessageParams,
  type SubscriptionInvoiceResponsePayload,
  type SubscriptionInvoiceValidationResult,
  type ValidateSubscriptionInvoiceResponseParams,
} from "./types.js";

type MessageHandler = (message: EcsAppMessage) => void | Promise<void>;
type ErrorHandler = (error: unknown, event?: Event) => void | Promise<void>;

export class NostrPaymentMessages {
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly relays: string[];
  private readonly timeoutMs: number;
  private readonly debug: boolean;
  private readonly pool: SimplePool;
  private readonly messageHandlers = new Set<MessageHandler>();
  private readonly errorHandlers = new Set<ErrorHandler>();
  private readonly seenEventIds = new Set<string>();
  private subscription: { close(): void } | null = null;

  constructor(options: EcsAppMessageOptions) {
    validateHexKey(options.privateKey, "Invalid app message private key");

    if (!options.relays.length) {
      throw new Error("At least one relay is required");
    }

    this.privateKey = options.privateKey;
    this.publicKey = getPublicKey(hexToBytes(options.privateKey));
    this.relays = options.relays;
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.debug = options.debug ?? false;
    this.pool = new SimplePool();
  }

  get pubkey(): string {
    return this.publicKey;
  }

  subscribe(): void {
    this.subscription?.close();

    this.subscription = this.pool.subscribeMany(
      this.relays,
      {
        kinds: [ECS_APP_MESSAGE_KIND],
        "#p": [this.publicKey],
      } as any,
      {
        onevent: async (event) => {
          await this.handleEvent(event);
        },
      }
    );
  }

  close(): void {
    this.subscription?.close();
    this.subscription = null;
    this.pool.close(this.relays);
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  async send<TPayload>(
    params: SendEcsAppMessageParams<TPayload>
  ): Promise<Event> {
    validateHexKey(params.recipientPubkey, "Invalid recipient pubkey");

    const envelope: EcsAppMessageEnvelope<TPayload> = {
      protocol: ECS_APP_MESSAGE_PROTOCOL,
      version: ECS_APP_MESSAGE_VERSION,
      type: params.type,
      messageId: params.messageId ?? createMessageId(),
      createdAt: params.createdAt ?? new Date().toISOString(),
      payload: params.payload,
    };

    const encrypted = await encryptContent(
      JSON.stringify(envelope),
      this.privateKey,
      params.recipientPubkey
    );

    const unsignedEvent: UnsignedEvent = {
      kind: ECS_APP_MESSAGE_KIND,
      created_at: nowSeconds(),
      content: encrypted,
      tags: [
        ["p", params.recipientPubkey],
        ["type", params.type],
        ["protocol", ECS_APP_MESSAGE_PROTOCOL],
        ["version", ECS_APP_MESSAGE_VERSION],
        ...subscriptionTags(params.payload),
        ...(params.tags ?? []),
      ],
      pubkey: this.publicKey,
    };

    const signedEvent = finalizeEvent(
      unsignedEvent as EventTemplate,
      hexToBytes(this.privateKey)
    );

    const published = this.pool.publish(this.relays, signedEvent);
    await withTimeout(Promise.all(published), this.timeoutMs, "publish app message");

    return signedEvent as Event;
  }

  private async handleEvent(event: Event): Promise<void> {
    if (this.seenEventIds.has(event.id)) return;
    this.seenEventIds.add(event.id);

    try {
      const plaintext = await decryptContent(
        event.content,
        this.privateKey,
        event.pubkey
      );

      const envelope = JSON.parse(plaintext) as EcsAppMessageEnvelope;
      validateEnvelope(envelope);

      const message: EcsAppMessage = {
        ...envelope,
        eventId: event.id,
        senderPubkey: event.pubkey,
        recipientPubkey: getTagValue(event.tags, "p"),
        receivedAt: new Date().toISOString(),
      };

      for (const handler of this.messageHandlers) {
        await handler(message);
      }
    } catch (error) {
      this.log("app message handling failed", error);
      for (const handler of this.errorHandlers) {
        await handler(error, event);
      }
    }
  }

  private log(...args: unknown[]): void {
    if (this.debug) console.log(...args);
  }
}

export function generateInvoiceRequestCode(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new Error("Request code must be at least 16 random bytes");
  }

  const bytes = new Uint8Array(byteLength);
  const cryptoApi = globalThis.crypto;

  if (!cryptoApi?.getRandomValues) {
    throw new Error("Secure random generator is not available");
  }

  cryptoApi.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export function validateSubscriptionInvoiceResponse(
  params: ValidateSubscriptionInvoiceResponseParams
): SubscriptionInvoiceValidationResult {
  const { response, pendingRequest } = params;
  const now = params.now ?? new Date();
  const errors: string[] = [];

  if (pendingRequest.consumed) {
    errors.push("Invoice request was already consumed");
  }

  if (new Date(pendingRequest.expiresAt).getTime() <= now.getTime()) {
    errors.push("Invoice request is expired");
  }

  if (response.subscriptionId !== pendingRequest.subscriptionId) {
    errors.push("Subscription id does not match");
  }

  if (response.merchantPubkey !== pendingRequest.merchantPubkey) {
    errors.push("Merchant pubkey does not match");
  }

  if (response.customerPubkey !== pendingRequest.customerPubkey) {
    errors.push("Customer pubkey does not match");
  }

  if (response.billingPeriod !== pendingRequest.billingPeriod) {
    errors.push("Billing period does not match");
  }

  if (response.requestCode !== pendingRequest.requestCode) {
    errors.push("Request code does not match");
  }

  if (
    pendingRequest.sequence !== undefined &&
    response.sequence !== pendingRequest.sequence
  ) {
    errors.push("Sequence does not match");
  }

  if (response.amountSats > pendingRequest.amountSatsExpected) {
    errors.push("Invoice amount exceeds the expected amount");
  }

  if (!response.invoice?.trim()) {
    errors.push("Invoice is required");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function validateEnvelope(envelope: EcsAppMessageEnvelope): void {
  if (envelope.protocol !== ECS_APP_MESSAGE_PROTOCOL) {
    throw new Error("Unsupported app message protocol");
  }

  if (envelope.version !== ECS_APP_MESSAGE_VERSION) {
    throw new Error("Unsupported app message version");
  }

  if (!envelope.type || !envelope.messageId || !envelope.createdAt) {
    throw new Error("Malformed app message envelope");
  }
}

function subscriptionTags(payload: unknown): string[][] {
  if (!payload || typeof payload !== "object") return [];

  const maybe = payload as {
    subscriptionId?: unknown;
    billingPeriod?: unknown;
  };
  const tags: string[][] = [];

  if (typeof maybe.subscriptionId === "string" && maybe.subscriptionId) {
    tags.push(["subscription", maybe.subscriptionId]);
  }

  if (typeof maybe.billingPeriod === "string" && maybe.billingPeriod) {
    tags.push(["period", maybe.billingPeriod]);
  }

  return tags;
}

function getTagValue(tags: string[][], name: string): string | undefined {
  return tags.find((tag) => tag[0] === name)?.[1];
}

function createMessageId(): string {
  return `msg_${generateInvoiceRequestCode(16)}`;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function validateHexKey(value: string, message: string): void {
  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(message);
  }
}

function hexToBytes(hex: string): Uint8Array {
  validateHexKey(hex, "Invalid hex string");

  const out = new Uint8Array(hex.length / 2);

  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }

  return out;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs} ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
