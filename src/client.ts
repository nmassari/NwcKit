import {
  SimplePool,
  finalizeEvent,
  getPublicKey,
  type Event,
  type EventTemplate,
  type UnsignedEvent,
} from "nostr-tools";

import { encryptContent, decryptContent } from "./crypto.js";

import type {
  NwcConnection,
  NwcKitOptions,
  NwcWalletInfo,
  MakeInvoiceParams,
  PayInvoiceParams,
  LookupInvoiceParams,
  ListTransactionsParams,
  NwcResponse,
  NwcBalanceResponse,
  MakeInvoiceResponse,
  PayInvoiceResponse,
  InvoiceLookupResponse,
  ListTransactionsResponse,
} from "./types.js";

// ---- NWC protocol kinds ----
const NWC_INFO_KIND = 13194;
const NWC_REQUEST_KIND = 23194;
const NWC_RESPONSE_KIND = 23195;

type NwcMethodMap = {
  get_info: {
    params: Record<string, never>;
    result: NwcWalletInfo;
  };
  get_balance: {
    params: Record<string, never>;
    result: NwcBalanceResponse;
  };
  make_invoice: {
    params: MakeInvoiceParams;
    result: MakeInvoiceResponse;
  };
  pay_invoice: {
    params: PayInvoiceParams;
    result: PayInvoiceResponse;
  };
  lookup_invoice: {
    params: LookupInvoiceParams;
    result: InvoiceLookupResponse;
  };
  list_transactions: {
    params: ListTransactionsParams;
    result: ListTransactionsResponse;
  };
};

type NwcMethod = keyof NwcMethodMap;

interface NwcRequestEnvelope<TMethod extends NwcMethod = NwcMethod> {
  method: TMethod;
  params?: NwcMethodMap[TMethod]["params"];
}

type PendingRequest = {
  timer: ReturnType<typeof setTimeout>;
  resolve: (value: NwcResponse) => void;
  reject: (reason?: unknown) => void;
};

export class NwcError extends Error {
  readonly code: string;
  readonly requestId?: string;

  constructor(code: string, message: string, requestId?: string) {
    super(message);
    this.name = "NwcError";
    this.code = code;
    this.requestId = requestId;
  }
}

export class NwcKit {
  private readonly connection: NwcConnection;
  private readonly timeoutMs: number;
  private readonly pool: SimplePool;
  private readonly clientSecret: string;
  private readonly clientPubkey: string;
  private readonly debug: boolean;

  private connected = false;
  private connectingPromise: Promise<void> | null = null;
  private destroyed = false;

  private responseSub: { close(): void } | null = null;
  private readonly pending = new Map<string, PendingRequest>();

  constructor(options: NwcKitOptions & { debug?: boolean }) {
    validateConnection(options.connection);

    this.connection = options.connection;
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.pool = new SimplePool();
    this.clientSecret = this.connection.secret;
    this.clientPubkey = getPublicKey(hexToBytes(this.clientSecret));
    this.debug = options.debug ?? false;

    this.log("clientPubkey:", this.clientPubkey);
  }

  async connect(): Promise<void> {
    this.assertAlive();

    if (this.connected) return;
    if (this.connectingPromise) return this.connectingPromise;

    this.connectingPromise = this.openRelayConnection();

    try {
      await this.connectingPromise;
      this.startResponseSubscription();
      this.connected = true;
    } finally {
      this.connectingPromise = null;
    }
  }

  async disconnect(): Promise<void> {
    this.responseSub?.close();
    this.responseSub = null;

    for (const [requestId, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(
        new NwcError(
          "DISCONNECTED",
          "Disconnected before receiving response",
          requestId
        )
      );
    }

    this.pending.clear();
    this.pool.close([this.connection.relayUrl]);
    this.connected = false;
    this.connectingPromise = null;
  }

  async getInfo(): Promise<NwcWalletInfo> {
    this.assertConnected();

    const event = await withTimeout(
      this.pool.get([this.connection.relayUrl], {
        kinds: [NWC_INFO_KIND],
        authors: [this.connection.walletPubkey],
        limit: 1,
      }),
      this.timeoutMs,
      "get_info"
    );

    if (!event) {
      throw new NwcError(
        "NO_INFO_EVENT",
        "Wallet info event not found on relay"
      );
    }

    this.log("NWC info event:", event);

    return parseWalletInfoEvent(event.content, normalizeTags(event.tags));
  }

  async getBalance(): Promise<NwcBalanceResponse> {
    return this.request("get_balance", {});
  }

  async makeInvoice(params: MakeInvoiceParams): Promise<MakeInvoiceResponse> {
    return this.request("make_invoice", params);
  }

  async payInvoice(invoice: string): Promise<PayInvoiceResponse>;
  async payInvoice(params: PayInvoiceParams): Promise<PayInvoiceResponse>;
  async payInvoice(
    input: string | PayInvoiceParams
  ): Promise<PayInvoiceResponse> {
    const params =
      typeof input === "string" ? { invoice: input } : input;

    return this.request("pay_invoice", params);
  }

  async lookupInvoice(
    params: LookupInvoiceParams
  ): Promise<InvoiceLookupResponse> {
    return this.request("lookup_invoice", params);
  }

  async listTransactions(
    params: ListTransactionsParams = {}
  ): Promise<ListTransactionsResponse> {
    return this.request("list_transactions", params);
  }

  async request<TMethod extends NwcMethod>(
    method: TMethod,
    params: NwcMethodMap[TMethod]["params"]
  ): Promise<NwcMethodMap[TMethod]["result"]> {
    this.assertConnected();

    const hasParams = Object.keys(params ?? {}).length > 0;
    const requestBody: NwcRequestEnvelope<TMethod> = hasParams
      ? { method, params }
      : { method };

    const plaintext = JSON.stringify(requestBody);

    const encrypted = await encryptContent(
      plaintext,
      this.clientSecret,
      this.connection.walletPubkey
    );

    const unsignedEvent: UnsignedEvent = {
      kind: NWC_REQUEST_KIND,
      created_at: nowSeconds(),
      content: encrypted,
      tags: [["p", this.connection.walletPubkey]],
      pubkey: this.clientPubkey,
    };

    const signedEvent = finalizeEvent(
      unsignedEvent as EventTemplate,
      hexToBytes(this.clientSecret)
    );

    this.log("NWC request:", signedEvent);

    const responsePromise = new Promise<NwcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(signedEvent.id);
        reject(
          new NwcError(
            "TIMEOUT",
            `${method} timed out after ${this.timeoutMs} ms`,
            signedEvent.id
          )
        );
      }, this.timeoutMs);

      this.pending.set(signedEvent.id, {
        timer,
        resolve,
        reject,
      });
    });

    const pubs = this.pool.publish([this.connection.relayUrl], signedEvent);

    for (const pub of pubs as any[]) {
      pub.on?.("ok", () => this.log("relay publish ok"));
      pub.on?.("seen", () => this.log("relay publish seen"));
      pub.on?.("failed", (reason: string) =>
        this.log("relay publish failed:", reason)
      );
    }

    const envelope = await responsePromise;

    if (envelope.error) {
      throw new NwcError(
        envelope.error.code,
        envelope.error.message,
        signedEvent.id
      );
    }

    return (envelope.result ?? {}) as NwcMethodMap[TMethod]["result"];
  }

  destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;
    this.responseSub?.close();
    this.responseSub = null;
    this.pool.close([this.connection.relayUrl]);
    this.connected = false;
    this.connectingPromise = null;
    this.pending.clear();
  }

  private async openRelayConnection(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let sub: { close(): void } | undefined;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        sub?.close();
        reject(
          new NwcError(
            "RELAY_TIMEOUT",
            `Relay connection timed out after ${this.timeoutMs} ms`
          )
        );
      }, this.timeoutMs);

      const finishOk = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        sub?.close();
        resolve();
      };

      const finishError = (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        sub?.close();
        reject(
          error instanceof Error
            ? error
            : new NwcError("RELAY_ERROR", "Failed to connect to relay")
        );
      };

      try {
        sub = this.pool.subscribeMany(
          [this.connection.relayUrl],
          {
            kinds: [NWC_INFO_KIND],
            authors: [this.connection.walletPubkey],
            limit: 1,
          },
          {
            onevent: () => finishOk(),
            oneose: () => finishOk(),
          }
        );
      } catch (error) {
        finishError(error);
      }
    });
  }

  private startResponseSubscription(): void {
    this.responseSub?.close();

    this.responseSub = this.pool.subscribeMany(
      [this.connection.relayUrl],
      {
        kinds: [NWC_RESPONSE_KIND],
        authors: [this.connection.walletPubkey],
      },
      {
        onevent: async (event) => {
          await this.handleResponseEvent(event);
        },
        oneose: () => {
          this.log("NWC response subscription ready");
        },
      }
    );
  }

  private async handleResponseEvent(event: Event): Promise<void> {
    this.log("NWC response event:", event);

    let plaintext: string;
    try {
      plaintext = await decryptContent(
        event.content,
        this.clientSecret,
        this.connection.walletPubkey
      );
    } catch(err) {
      this.log("decrypt failed:", err);
      return;
    }

    this.log("NWC decrypted response:", plaintext);

    let envelope: NwcResponse;
    try {
      envelope = JSON.parse(plaintext) as NwcResponse;
    } catch(err) {
      this.log("reading decrypted failed:", err);
      return;
    }

    const tags = normalizeTags(event.tags);
    const eTag = tags.find((t) => t[0] === "e")?.[1];
    if (!eTag || typeof eTag !== "string") {
      this.log("missing e tag");
      return;
    }
    const pending = this.pending.get(eTag);
    if (!pending) return;
    this.pending.delete(eTag);
    clearTimeout(pending.timer);
    this.pending.delete(eTag);
    pending.resolve(envelope);
  }

  private assertConnected(): void {
    this.assertAlive();

    if (!this.connected) {
      throw new NwcError(
        "NOT_CONNECTED",
        "NwcKit is not connected. Call connect() first."
      );
    }
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new NwcError("DESTROYED", "NwcKit has been destroyed");
    }
  }

  private log(...args: unknown[]): void {
    if (!this.debug) return;
    console.log(...args);
  }
}

// ---- Helpers ----

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }

  const out = new Uint8Array(hex.length / 2);

  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }

  return out;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new NwcError(
          "TIMEOUT",
          `${label} timed out after ${timeoutMs} ms`
        )
      );
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

function parseWalletInfoEvent(
  content: string,
  tags: string[][]
): NwcWalletInfo {
  const methods = content.trim().split(/\s+/).filter(Boolean);

  const pubkey = getSingleTagValue(tags, "pubkey");
  const alias = getSingleTagValue(tags, "alias");
  const color = getSingleTagValue(tags, "color");
  const network = getSingleTagValue(tags, "network");
  const blockHeightRaw = getSingleTagValue(tags, "block_height");

  const blockHeight =
    blockHeightRaw !== undefined && blockHeightRaw !== ""
      ? Number(blockHeightRaw)
      : undefined;

  return {
    alias: alias ?? undefined,
    color: color ?? undefined,
    pubkey: pubkey ?? undefined,
    network: network ?? undefined,
    block_height:
      blockHeight !== undefined && Number.isFinite(blockHeight)
        ? blockHeight
        : undefined,
    methods,
  };
}

function getSingleTagValue(
  tags: string[][],
  tagName: string
): string | undefined {
  const tag = tags.find((t) => t[0] === tagName);
  return tag?.[1];
}

function normalizeTags(tags: unknown): string[][] {
  if (!Array.isArray(tags)) return [];

  return tags.filter(
    (tag): tag is string[] =>
      Array.isArray(tag) && tag.every((x) => typeof x === "string")
  );
}

function validateConnection(connection: NwcConnection): void {
  if (!connection) {
    throw new Error("Connection is required");
  }

  if (!connection.secret || !/^[0-9a-fA-F]{64}$/.test(connection.secret)) {
    throw new Error("Connection secret must be a 32-byte hex string");
  }

  if (
    !connection.walletPubkey ||
    !/^[0-9a-fA-F]{64}$/.test(connection.walletPubkey)
  ) {
    throw new Error("Wallet pubkey must be a 32-byte hex string");
  }

  if (!connection.relayUrl || !/^wss?:\/\//i.test(connection.relayUrl)) {
    throw new Error("Relay URL must start with ws:// or wss://");
  }
}