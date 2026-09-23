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
export declare function encryptContent(plaintext: string, secret: string, pubkey: string): Promise<string>;
/**
 * Decrypts a ciphertext payload coming from the wallet pubkey using the client secret.
 *
 * @param ciphertext - encrypted content received from relay
 * @param secret - hex private key of the client
 * @param pubkey - wallet pubkey
 */
export declare function decryptContent(ciphertext: string, secret: string, pubkey: string): Promise<string>;
/**
 * Placeholder for future support.
 * Not used yet, but useful to keep structure clean for later refactor.
 */
export declare function encryptContentWithMode(mode: NwcEncryptionMode, plaintext: string, secret: string, pubkey: string): Promise<string>;
/**
 * Placeholder for future support.
 * Not used yet, but useful to keep structure clean for later refactor.
 */
export declare function decryptContentWithMode(mode: NwcEncryptionMode, ciphertext: string, secret: string, pubkey: string): Promise<string>;
