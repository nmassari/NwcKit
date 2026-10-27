import { SimplePool, nip19, verifyEvent, type Event, type EventTemplate } from "nostr-tools";

export const ECS_SUBSCRIPTION_OFFER_KIND = 31946;
export const ECS_SUBSCRIPTION_OFFER_PROTOCOL = "ecs-subscriptions";
export const ECS_SUBSCRIPTION_OFFER_VERSION = "0.1";

export type SubscriptionBillingModel =
  | "recurring_fixed"
  | "fixed_installments"
  | "recurring_variable";

export interface SubscriptionOffer {
  protocol: typeof ECS_SUBSCRIPTION_OFFER_PROTOCOL;
  version: typeof ECS_SUBSCRIPTION_OFFER_VERSION;
  type: "subscription.offer";
  offerId: string;
  merchantName: string;
  description: string;
  billingModel: SubscriptionBillingModel;
  asset: "LNBTC" | "LNUSDT";
  amount: string;
  unit: "sat" | "USDT";
  interval: "daily" | "weekly" | "monthly" | "yearly";
  suggestedMaxSinglePayment: string;
  suggestedMaxPeriodSpend: string;
  totalAmount?: string;
  installmentCount?: number;
  firstDueAt?: string;
  validUntil?: string;
  authorizationExpiresAt?: string;
}

export interface VerifiedSubscriptionOffer {
  offer: SubscriptionOffer;
  merchantPubkey: string;
  event: Event;
}

export function createSubscriptionOfferEvent(params: {
  merchantPubkey: string;
  offer: SubscriptionOffer;
  createdAt?: number;
}): EventTemplate & { pubkey: string } {
  validatePubkey(params.merchantPubkey);
  const offer = normalizeOffer(params.offer);
  return {
    kind: ECS_SUBSCRIPTION_OFFER_KIND,
    created_at: params.createdAt ?? Math.floor(Date.now() / 1000),
    pubkey: params.merchantPubkey.toLowerCase(),
    tags: [
      ["d", offer.offerId],
      ["t", "ecs-subscription-offer"],
      ["protocol", ECS_SUBSCRIPTION_OFFER_PROTOCOL],
      ["version", ECS_SUBSCRIPTION_OFFER_VERSION],
      ["asset", offer.asset],
      ["billing_model", offer.billingModel],
      ["interval", offer.interval],
    ],
    content: JSON.stringify(offer),
  };
}

export function verifySubscriptionOfferEvent(event: Event): VerifiedSubscriptionOffer {
  if (event.kind !== ECS_SUBSCRIPTION_OFFER_KIND || !verifyEvent(event)) {
    throw new Error("Subscription offer signature is invalid");
  }
  const identifier = getTag(event.tags, "d");
  if (!identifier || getTag(event.tags, "protocol") !== ECS_SUBSCRIPTION_OFFER_PROTOCOL ||
      getTag(event.tags, "version") !== ECS_SUBSCRIPTION_OFFER_VERSION) {
    throw new Error("Subscription offer tags are invalid");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(event.content); }
  catch { throw new Error("Subscription offer content is not valid JSON"); }
  const offer = normalizeOffer(decoded);
  if (offer.offerId !== identifier) {
    throw new Error("Subscription offer id does not match its signed event");
  }
  return { offer, merchantPubkey: event.pubkey.toLowerCase(), event };
}

export function encodeSubscriptionOfferReference(event: Event, relays: string[]): string {
  const identifier = getTag(event.tags, "d");
  if (event.kind !== ECS_SUBSCRIPTION_OFFER_KIND || !identifier) {
    throw new Error("Cannot encode an invalid subscription offer event");
  }
  return `nostr:${nip19.naddrEncode({
    identifier,
    pubkey: event.pubkey,
    kind: ECS_SUBSCRIPTION_OFFER_KIND,
    relays: normalizeRelays(relays),
  })}`;
}

export function decodeSubscriptionOfferReference(reference: string, fallbackRelays: string[] = []) {
  const encoded = reference.trim().replace(/^web\+nostr:/i, "nostr:").replace(/^nostr:/i, "");
  const decoded = nip19.decode(encoded);
  if (decoded.type !== "naddr" || decoded.data.kind !== ECS_SUBSCRIPTION_OFFER_KIND) {
    throw new Error("QR code is not an EasyCryptoSend subscription offer");
  }
  return {
    identifier: decoded.data.identifier,
    merchantPubkey: decoded.data.pubkey.toLowerCase(),
    kind: decoded.data.kind,
    relays: normalizeRelays([...(decoded.data.relays ?? []), ...fallbackRelays]),
  };
}

export async function loadSubscriptionOffer(
  reference: string,
  fallbackRelays: string[] = [],
  timeoutMs = 15000
) {
  const pointer = decodeSubscriptionOfferReference(reference, fallbackRelays);
  if (!pointer.relays.length) throw new Error("Subscription offer does not specify a Nostr relay");
  const pool = new SimplePool();
  try {
    const event = await withTimeout(pool.get(pointer.relays, {
      kinds: [ECS_SUBSCRIPTION_OFFER_KIND],
      authors: [pointer.merchantPubkey],
      "#d": [pointer.identifier],
    }), timeoutMs, "load subscription offer");
    if (!event) throw new Error("Subscription offer was not found on the advertised relay");
    const verified = verifySubscriptionOfferEvent(event);
    if (verified.offer.offerId !== pointer.identifier || verified.merchantPubkey !== pointer.merchantPubkey) {
      throw new Error("Subscription offer does not match its QR reference");
    }
    return { ...verified, reference, relays: pointer.relays };
  } finally {
    pool.close(pointer.relays);
  }
}

export async function publishSubscriptionOffer(event: Event, relays: string[], timeoutMs = 15000) {
  verifySubscriptionOfferEvent(event);
  const normalizedRelays = normalizeRelays(relays);
  if (!normalizedRelays.length) throw new Error("At least one Nostr relay is required");
  const pool = new SimplePool();
  try {
    await withTimeout(Promise.all(pool.publish(normalizedRelays, event)), timeoutMs, "publish subscription offer");
  } finally {
    pool.close(normalizedRelays);
  }
}

function normalizeOffer(input: unknown): SubscriptionOffer {
  const value = input as Partial<SubscriptionOffer> | null;
  if (!value || value.protocol !== ECS_SUBSCRIPTION_OFFER_PROTOCOL ||
      value.version !== ECS_SUBSCRIPTION_OFFER_VERSION || value.type !== "subscription.offer") {
    throw new Error("Unsupported subscription offer format");
  }
  const offerId = requiredText(value.offerId, "Offer id", 128);
  const merchantName = requiredText(value.merchantName, "Merchant name", 120);
  const description = requiredText(value.description, "Description", 280);
  const asset = validateAsset(value.asset);
  const billingModel = validateBillingModel(value.billingModel);
  const interval = validateInterval(value.interval);
  const amount = positiveAmount(value.amount, "Amount");
  const maxSinglePayment = positiveAmount(value.suggestedMaxSinglePayment ?? amount, "Suggested maximum per payment");
  const maxPeriodSpend = positiveAmount(value.suggestedMaxPeriodSpend ?? maxSinglePayment, "Suggested maximum per period");
  if (Number(amount) > Number(maxSinglePayment) || Number(maxSinglePayment) > Number(maxPeriodSpend)) {
    throw new Error("Subscription offer spending limits are inconsistent");
  }
  let totalAmount: string | undefined;
  let installmentCount: number | undefined;
  if (billingModel === "fixed_installments") {
    totalAmount = positiveAmount(value.totalAmount, "Total amount");
    installmentCount = Number(value.installmentCount);
    if (!Number.isInteger(installmentCount) || installmentCount <= 0 || installmentCount > 10000) {
      throw new Error("Installment count must be an integer between 1 and 10000");
    }
    if (Number(totalAmount) > Number(amount) * installmentCount ||
        Number(totalAmount) <= Number(amount) * (installmentCount - 1)) {
      throw new Error("Total amount is inconsistent with amount and installment count");
    }
  }
  return {
    protocol: ECS_SUBSCRIPTION_OFFER_PROTOCOL, version: ECS_SUBSCRIPTION_OFFER_VERSION,
    type: "subscription.offer", offerId, merchantName, description, billingModel, asset,
    amount, unit: asset === "LNBTC" ? "sat" : "USDT", interval,
    suggestedMaxSinglePayment: maxSinglePayment, suggestedMaxPeriodSpend: maxPeriodSpend,
    totalAmount, installmentCount,
    firstDueAt: normalizeOptionalDate(value.firstDueAt, "First payment date"),
    validUntil: normalizeOptionalDate(value.validUntil, "Offer expiry"),
    authorizationExpiresAt: normalizeOptionalDate(value.authorizationExpiresAt, "Authorization expiry"),
  };
}

function validateBillingModel(value: unknown): SubscriptionBillingModel {
  const normalized = value ?? "recurring_fixed";
  if (normalized !== "recurring_fixed" && normalized !== "fixed_installments" && normalized !== "recurring_variable") {
    throw new Error("Subscription billing model is invalid");
  }
  return normalized;
}
function validateAsset(value: unknown): "LNBTC" | "LNUSDT" {
  if (value !== "LNBTC" && value !== "LNUSDT") throw new Error("Subscription offer asset must be LNBTC or LNUSDT");
  return value;
}
function validateInterval(value: unknown): SubscriptionOffer["interval"] {
  if (value !== "daily" && value !== "weekly" && value !== "monthly" && value !== "yearly") {
    throw new Error("Subscription offer interval is invalid");
  }
  return value;
}
function positiveAmount(value: unknown, label: string): string {
  const normalized = String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized) || Number(normalized) <= 0) throw new Error(`${label} must be a positive amount`);
  return normalized;
}
function requiredText(value: unknown, label: string, maxLength: number): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maxLength) throw new Error(`${label} is required and must not exceed ${maxLength} characters`);
  return normalized;
}
function normalizeOptionalDate(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} is invalid`);
  return parsed.toISOString();
}
function validatePubkey(value: string) {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error("Merchant pubkey must be a 32-byte hex key");
}
function getTag(tags: string[][], name: string): string | undefined {
  return tags.find(tag => tag[0] === name && tag[1])?.[1];
}
function normalizeRelays(relays: string[]): string[] {
  return Array.from(new Set(relays.map(relay => relay.trim()).filter(relay => {
    try { const parsed = new URL(relay); return parsed.protocol === "wss:" || parsed.protocol === "ws:"; }
    catch { return false; }
  })));
}
async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    })]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
