import { compactDecrypt, CompactEncrypt } from "jose";

import { deriveKey } from "./utils/derive-key";

/**
 * Service that provides encryption and decryption functionality using JWE (JSON Web Encryption).
 *
 * Uses HKDF to derive a 32-byte key from the secret, then A256GCMKW for key management
 * and A256GCM for content encryption. Accepts secrets of any length.
 *
 * @example
 * ```typescript
 * import { CryptService } from '@nest-boot/crypt';
 *
 * // Initialize at application startup for static usage
 * CryptService.init(process.env.CRYPT_SECRET);
 *
 * // Use static methods
 * const encrypted = await CryptService.encrypt(data);
 * const decrypted = await CryptService.decrypt(encrypted);
 * ```
 */
export class CryptService {
  private static _instance?: CryptService;

  /**
   * Gets the static CryptService instance.
   * @throws Error if CryptService has not been initialized via `init()`
   * @returns The CryptService instance
   */
  static get instance(): CryptService {
    if (!this._instance) {
      throw new Error("CryptService not initialized");
    }

    return this._instance;
  }

  /**
   * Initializes the static CryptService instance with the given secret.
   * Call this method at application startup to configure the default secret.
   *
   * @param secret - The secret key to use for encryption/decryption
   *
   * @example
   * ```typescript
   * // In your application bootstrap
   * CryptService.init(process.env.CRYPT_SECRET);
   * ```
   */
  static init(secret: string): void {
    this._instance = new CryptService(secret);
  }

  /**
   * Encrypts a string value using the static instance.
   * @param value - The plaintext string to encrypt
   * @returns A JWE compact serialization string
   * @throws Error if CryptService has not been initialized via `init()`
   */
  static encrypt(value: string): Promise<string> {
    return this.instance.encrypt(value);
  }

  /**
   * Decrypts a JWE string using the static instance.
   * @param value - The JWE compact serialization string to decrypt
   * @returns The decrypted plaintext string
   * @throws Error if CryptService has not been initialized via `init()`
   */
  static decrypt(value: string): Promise<string> {
    return this.instance.decrypt(value);
  }

  private readonly secret: string;
  private derivedKeyPromise?: Promise<Uint8Array>;

  /**
   * Creates an instance of CryptService.
   * @param secret - The secret key to use for encryption/decryption
   */
  constructor(secret: string) {
    this.secret = secret;
  }

  /**
   * Gets or creates the derived key asynchronously.
   */
  private getDerivedKey(): Promise<Uint8Array> {
    return (this.derivedKeyPromise ??= deriveKey(this.secret));
  }

  /**
   * Encrypts a string value using JWE with A256GCMKW and A256GCM.
   * The secret is first derived using HKDF-SHA256.
   * @param value - The plaintext string to encrypt
   * @returns A JWE compact serialization string
   */
  async encrypt(value: string): Promise<string> {
    const key = await this.getDerivedKey();

    return await new CompactEncrypt(new TextEncoder().encode(value))
      .setProtectedHeader({ alg: "A256GCMKW", enc: "A256GCM" })
      .encrypt(key);
  }

  /**
   * Decrypts a JWE compact serialization string.
   * The secret is first derived using HKDF-SHA256.
   * @param value - The JWE string to decrypt
   * @returns The decrypted plaintext string
   */
  async decrypt(value: string): Promise<string> {
    const key = await this.getDerivedKey();

    const { plaintext } = await compactDecrypt(value, key, {
      keyManagementAlgorithms: ["A256GCMKW"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });

    return new TextDecoder().decode(plaintext);
  }
}
