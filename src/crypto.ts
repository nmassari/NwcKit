import { nip04, nip44 } from "nostr-tools";

/**
 * Encryption modes supported by NWC. NIP-44 v2 is preferred whenever the
 * wallet advertises it; NIP-04 remains available for legacy wallets.
 */
export type NwcEncryptionMode = "nip04" | "nip44_v2";

/**
 * Encrypts a plaintext payload for the wallet pubkey using the client secret.
 *
 * @param plaintext - JSON string payload to encrypt
 * @param secret - hex private key of the client
 * @param pubkey - wallet pubkey
 */
export async function encryptContent(
  plaintext: string,
  secret: string,
  pubkey: string
): Promise<string> {
  validateHexKey(secret, "Invalid client secret");
  validateHexKey(pubkey, "Invalid wallet pubkey");

  return nip04.encrypt(secret, pubkey, plaintext);
}

/**
 * Decrypts a ciphertext payload coming from the wallet pubkey using the client secret.
 *
 * @param ciphertext - encrypted content received from relay
 * @param secret - hex private key of the client
 * @param pubkey - wallet pubkey
 */
export async function decryptContent(
  ciphertext: string,
  secret: string,
  pubkey: string
): Promise<string> {
  validateHexKey(secret, "Invalid client secret");
  validateHexKey(pubkey, "Invalid wallet pubkey");

  return nip04.decrypt(secret, pubkey, ciphertext);
}

/**
 * Placeholder for future support.
 * Not used yet, but useful to keep structure clean for later refactor.
 */
export async function encryptContentWithMode(
  mode: NwcEncryptionMode,
  plaintext: string,
  secret: string,
  pubkey: string
): Promise<string> {
  switch (mode) {
    case "nip04":
      return encryptContent(plaintext, secret, pubkey);

    case "nip44_v2": {
      validateHexKey(secret, "Invalid client secret");
      validateHexKey(pubkey, "Invalid wallet pubkey");
      const conversationKey = nip44.v2.utils.getConversationKey(
        hexToBytes(secret),
        pubkey
      );
      return nip44.v2.encrypt(plaintext, conversationKey);
    }

    default:
      throw new Error(`Unsupported encryption mode: ${mode}`);
  }
}

/**
 * Placeholder for future support.
 * Not used yet, but useful to keep structure clean for later refactor.
 */
export async function decryptContentWithMode(
  mode: NwcEncryptionMode,
  ciphertext: string,
  secret: string,
  pubkey: string
): Promise<string> {
  switch (mode) {
    case "nip04":
      return decryptContent(ciphertext, secret, pubkey);

    case "nip44_v2": {
      validateHexKey(secret, "Invalid client secret");
      validateHexKey(pubkey, "Invalid wallet pubkey");
      const conversationKey = nip44.v2.utils.getConversationKey(
        hexToBytes(secret),
        pubkey
      );
      return nip44.v2.decrypt(ciphertext, conversationKey);
    }

    default:
      throw new Error(`Unsupported encryption mode: ${mode}`);
  }
}

function validateHexKey(value: string, message: string): void {
  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(message);
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }
  return bytes;
}
