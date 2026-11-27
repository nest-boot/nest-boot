import { compactDecrypt, CompactEncrypt } from "jose";

import { type CryptOptions } from "./crypt-options.interface.js";
import { deriveKey } from "./utils/derive-key.util.js";

/**
 * Service that provides encryption and decryption functionality using JWE (JSON Web Encryption).
 *
 * Uses HKDF to derive a 32-byte key from the secret, then A256GCMKW for key management
 * and A256GCM for content encryption. Accepts secrets of any length.
 * @example
 * ```typescript
 * import { CryptService } from '@nest-boot/crypt';
 *
 * // Initialize at application startup for static usage
 * CryptService.init(process.env.CRYPT_SECRET);
 *
 * // Use static methods
 * const encrypted = await CryptService.encrypt(data, { context: 'user:ssn' });
 * const decrypted = await CryptService.decrypt(encrypted, { context: 'user:ssn' });
 * ```
 */
export class CryptService {
  /**
   * Singleton instance.
   * @internal
   */
  private static _instance?: CryptService;

  /**
   * Gets the static CryptService instance.
   * @throws {Error} if CryptService has not been initialized via `init()`
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
   * @param secret - The secret key to use for encryption/decryption
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
   * @param options - Optional encryption settings including HKDF context
   * @returns A JWE compact serialization string
   * @throws {Error} if CryptService has not been initialized via `init()` or context is empty
   */
  static encrypt(value: string, options?: CryptOptions): Promise<string> {
    return this.instance.encrypt(value, options);
  }

  /**
   * Decrypts a JWE string using the static instance.
   * @param value - The JWE compact serialization string to decrypt
   * @param options - Optional decryption settings including HKDF context
   * @returns The decrypted plaintext string
   * @throws {Error} if CryptService has not been initialized via `init()` or context is empty
   */
  static decrypt(value: string, options?: CryptOptions): Promise<string> {
    return this.instance.decrypt(value, options);
  }

  /**
   * Secret key used for encryption.
   * @internal
   */
  private readonly secret: string;
  /**
   * Cached promise for the root encryption key.
   * @internal
   */
  private rootKeyPromise?: Promise<Uint8Array>;
  /**
   * Cached promises for context-scoped encryption keys.
   * @internal
   */
  private readonly contextualKeyPromises = new Map<
    string,
    Promise<Uint8Array>
  >();

  /**
   * Creates a new CryptService instance.
   * @param secret - The secret key to use for encryption/decryption
   */
  constructor(secret: string) {
    this.secret = secret;
  }

  /**
   * Gets or creates the derived key asynchronously for the root or specified context.
   * @param options - Optional HKDF context configuration
   * @returns Cached promise for the derived encryption key
   */
  private getDerivedKey(options?: CryptOptions): Promise<Uint8Array> {
    const context = options?.context;
    if (context === undefined) {
      return (this.rootKeyPromise ??= deriveKey(this.secret));
    }

    if (typeof context !== "string" || !context.trim()) {
      throw new Error("Crypt context must be a non-empty string.");
    }

    let keyPromise = this.contextualKeyPromises.get(context);
    if (!keyPromise) {
      keyPromise = deriveKey(this.secret, context);
      this.contextualKeyPromises.set(context, keyPromise);
    }

    return keyPromise;
  }

  /**
   * Encrypts a string value using JWE with A256GCMKW and A256GCM.
   * The secret is first derived using HKDF-SHA256.
   * @param value - The plaintext string to encrypt
   * @param options - Optional encryption settings including HKDF context
   * @returns A JWE compact serialization string
   */
  async encrypt(value: string, options?: CryptOptions): Promise<string> {
    const key = await this.getDerivedKey(options);

    return await new CompactEncrypt(new TextEncoder().encode(value))
      .setProtectedHeader({ alg: "A256GCMKW", enc: "A256GCM" })
      .encrypt(key);
  }

  /**
   * Decrypts a JWE compact serialization string.
   * The secret is first derived using HKDF-SHA256.
   * @param value - The JWE string to decrypt
   * @param options - Optional decryption settings including HKDF context
   * @returns The decrypted plaintext string
   */
  async decrypt(value: string, options?: CryptOptions): Promise<string> {
    const key = await this.getDerivedKey(options);

    const { plaintext } = await compactDecrypt(value, key, {
      keyManagementAlgorithms: ["A256GCMKW"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });

    return new TextDecoder().decode(plaintext);
  }
}
