import { hash, verify } from "@node-rs/argon2";

/**
 * Service that provides password hashing and verification using Argon2 algorithm.
 *
 * @example
 * ```typescript
 * import { HashService } from '@nest-boot/hash';
 *
 * // Initialize at application startup
 * HashService.init(process.env.HASH_SECRET);
 *
 * // Use static methods
 * const hashed = await HashService.hash(password);
 * const isValid = await HashService.verify(hashed, password);
 * ```
 */

export class HashService {
  private static _instance?: HashService;

  /**
   * Gets the static HashService instance.
   * @throws Error if HashService has not been initialized via `init()`
   * @returns The HashService instance
   */
  static get instance(): HashService {
    if (!this._instance) {
      throw new Error("HashService not initialized");
    }

    return this._instance;
  }

  /**
   * Initializes the static HashService instance with the given secret.
   * Call this method at application startup to configure the default secret.
   *
   * @param secret - The secret key to use for hashing
   *
   * @example
   * ```typescript
   * // In your application bootstrap
   * HashService.init(process.env.HASH_SECRET);
   * ```
   */
  static init(secret?: string): void {
    this._instance = new HashService(secret);
  }

  /**
   * Creates a hash from the given value using the static instance.
   * @param value - The value to hash (password or other sensitive data)
   * @param secret - Optional secret key to use instead of the default
   * @returns The hashed string
   * @throws Error if HashService has not been initialized via `init()`
   */
  static hash(value: string | Buffer, secret?: string): Promise<string> {
    return this.instance.hash(value, secret);
  }

  /**
   * Verifies a value against a hash using the static instance.
   * @param hashed - The hash to verify against
   * @param value - The value to verify
   * @param secret - Optional secret key to use instead of the default
   * @returns True if the value matches the hash, false otherwise
   * @throws Error if HashService has not been initialized via `init()`
   */
  static verify(
    hashed: string | Buffer,
    value: string | Buffer,
    secret?: string,
  ): Promise<boolean> {
    return this.instance.verify(hashed, value, secret);
  }

  private readonly secret?: Buffer;

  /**
   * Creates an instance of HashService.
   * @param secret - Optional secret key to use for hashing
   */
  constructor(secret?: string) {
    this.secret = secret ? Buffer.from(secret) : undefined;
  }

  /**
   * Creates a hash from the given value using Argon2.
   * @param value - The value to hash (password or other sensitive data)
   * @param secret - Optional secret key to use instead of the default
   * @returns The hashed string
   */
  async hash(value: string | Buffer, secret?: string): Promise<string> {
    return await hash(value, {
      secret: typeof secret !== "undefined" ? Buffer.from(secret) : this.secret,
    });
  }

  /**
   * Creates a hash from the given value using Argon2.
   * @param value - The value to hash (password or other sensitive data)
   * @param secret - Optional secret key to use instead of the default
   * @returns The hashed string
   * @deprecated Use `hash` instead
   */
  async create(value: string | Buffer, secret?: string): Promise<string> {
    return await this.hash(value, secret);
  }

  /**
   * Verifies a value against a hash.
   * @param hashed - The hash to verify against
   * @param value - The value to verify
   * @param secret - Optional secret key to use instead of the default
   * @returns True if the value matches the hash, false otherwise
   */
  async verify(
    hashed: string | Buffer,
    value: string | Buffer,
    secret?: string,
  ): Promise<boolean> {
    return await verify(hashed, value, {
      secret: typeof secret !== "undefined" ? Buffer.from(secret) : this.secret,
    });
  }
}
