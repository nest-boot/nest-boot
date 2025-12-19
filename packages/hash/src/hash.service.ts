import { Inject, Injectable, Optional } from "@nestjs/common";
import { hash, verify } from "@node-rs/argon2";

import { MODULE_OPTIONS_TOKEN } from "./hash.module-definition";
import { HashModuleOptions } from "./hash-module-options.interface";

/**
 * Service that provides password hashing and verification using Argon2 algorithm.
 *
 * @example
 * ```typescript
 * import { HashService } from '@nest-boot/hash';
 *
 * @Injectable()
 * export class AuthService {
 *   constructor(private readonly hashService: HashService) {}
 *
 *   async hashPassword(password: string): Promise<string> {
 *     return this.hashService.create(password);
 *   }
 *
 *   async verifyPassword(hash: string, password: string): Promise<boolean> {
 *     return this.hashService.verify(hash, password);
 *   }
 * }
 * ```
 */
@Injectable()
export class HashService {
  private readonly secret?: Buffer;

  /**
   * Creates an instance of HashService.
   * @param options - Configuration options for the hash service
   */
  constructor(
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    options: HashModuleOptions = {},
  ) {
    const secret =
      options.secret ?? process.env.HASH_SECRET ?? process.env.APP_SECRET;

    if (secret) {
      this.secret = Buffer.from(secret);
    }
  }

  /**
   * Creates a hash from the given value using Argon2.
   * @param value - The value to hash (password or other sensitive data)
   * @param secret - Optional secret key to use instead of the default
   * @returns The hashed string
   */
  async create(value: string | Buffer, secret?: string): Promise<string> {
    return await hash(value, {
      secret: typeof secret !== "undefined" ? Buffer.from(secret) : this.secret,
    });
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
