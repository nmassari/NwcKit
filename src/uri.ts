import type { NwcConnection } from "./types.js";

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
    walletPubkey,
    relayUrl: decodeURIComponent(relayUrl),
    secret,
    lud16,
  };
}