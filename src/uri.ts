import { generateSecretKey, getPublicKey } from "nostr-tools";
import type { BuildNwcUriParams, NwcClientIdentity, NwcConnection } from "./types.js";

const hexKeyPattern = /^[0-9a-f]{64}$/i;

function bytesToHex(value: Uint8Array): string {
  return Array.from(value, byte => byte.toString(16).padStart(2, "0")).join("");
}

function requireHexKey(value: string, name: string): string {
  const normalized = value.trim().toLowerCase();
  if (!hexKeyPattern.test(normalized)) {
    throw new Error(`${name} must be a 32-byte hex key`);
  }

  return normalized;
}

export function generateNwcClientIdentity(): NwcClientIdentity {
  const secretBytes = generateSecretKey();
  return {
    secret: bytesToHex(secretBytes),
    publicKey: getPublicKey(secretBytes),
  };
}

export function buildNwcUri(params: BuildNwcUriParams): string {
  const walletPubkey = requireHexKey(params.walletPubkey, "Wallet pubkey");
  const secret = requireHexKey(params.secret, "Client secret");
  const relayUrl = params.relayUrl.trim();

  if (!relayUrl) throw new Error("Relay URL is required");

  const query = new URLSearchParams({ relay: relayUrl, secret });
  if (params.lud16?.trim()) query.set("lud16", params.lud16.trim());

  return `nostr+walletconnect://${walletPubkey}?${query.toString()}`;
}

export function parseNwcUri(uri: string): NwcConnection {
  if (!uri.startsWith("nostr+walletconnect://") && !uri.startsWith("nostr+walletconnect:")) {
    throw new Error("Invalid NWC URI");
  }

  const normalized = uri.replace("nostr+walletconnect://", "nostr+walletconnect:");
  const raw = normalized.slice("nostr+walletconnect:".length);

  const [walletPubkey, queryString] = raw.split("?");
  if (!walletPubkey || !queryString) {
    throw new Error("Malformed NWC URI");
  }

  const params = new URLSearchParams(queryString);
  const relayUrl = params.get("relay");
  const secret = params.get("secret");
  const lud16 = params.get("lud16") ?? undefined;

  if (!relayUrl) throw new Error("Missing relay parameter");
  if (!secret) throw new Error("Missing secret parameter");

  return {
    walletPubkey: requireHexKey(walletPubkey, "Wallet pubkey"),
    relayUrl: decodeURIComponent(relayUrl),
    secret: requireHexKey(secret, "Client secret"),
    lud16,
  };
}

export function isNwcUri(value: string): boolean {
  try {
    parseNwcUri(value);
    return true;
  } catch {
    return false;
  }
}
