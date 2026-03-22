import { nip04 } from "nostr-tools";

/**
 * Current encryption mode actually implemented.
 * For now we use NIP-04 to keep the first working version simple.
 * NIP-44 can be added later without changing the client public API too much.
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

    case "nip44_v2":
      throw new Error("NIP-44 encryption not implemented yet");

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

    case "nip44_v2":
      throw new Error("NIP-44 decryption not implemented yet");

    default:
      throw new Error(`Unsupported encryption mode: ${mode}`);
  }
}

function validateHexKey(value: string, message: string): void {
  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(message);
  }
}