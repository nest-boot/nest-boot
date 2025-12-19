import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  createCipheriv,
  createDecipheriv,
  type Encoding,
  randomBytes,
  scrypt,
} from "crypto";
import { promisify } from "util";

import { MODULE_OPTIONS_TOKEN } from "./crypt.module-definition";
import { CryptModuleOptions } from "./crypt-module-options.interface";

/**
 * Service that provides encryption and decryption functionality using AES-256-GCM algorithm.
 *
 * @example
 * ```typescript
 * import { CryptService } from '@nest-boot/crypt';
 *
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly cryptService: CryptService) {}
 *
 *   async encryptData(data: string): Promise<string> {
 *     return this.cryptService.encrypt(data);
 *   }
 *
 *   async decryptData(encrypted: string): Promise<string> {
 *     return this.cryptService.decrypt(encrypted);
 *   }
 * }
 * ```
 */
@Injectable()
export class CryptService {
  readonly #algorithm = "aes-256-gcm";

  readonly #encoding: Encoding = "base64";

  readonly #keyByteLength: number = 32;

  readonly #saltByteLength: number = 16;

  readonly #viByteLength: number = 16;

  readonly #secret: string;

  /**
   * Creates an instance of CryptService.
   * @param options - Configuration options for the crypt service
   * @throws Error if no secret is provided via options or environment variables
   */
  constructor(
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    options: CryptModuleOptions = {},
  ) {
    const secret =
      options.secret ?? process.env.CRYPT_SECRET ?? process.env.APP_SECRET;

    if (!secret) {
      throw new Error(
        "Crypt secret is missing. Set CRYPT_SECRET or APP_SECRET or pass a secret option.",
      );
    }

    this.#secret = secret;
  }

  /**
   * Encrypts a string value using AES-256-GCM algorithm.
   * @param value - The plaintext string to encrypt
   * @param secret - Optional secret key to use instead of the default
   * @returns A base64-encoded encrypted string containing IV, auth tag, data, and salt
   */
  async encrypt(value: string, secret?: string): Promise<string> {
    const { key, salt } = await this.#getKeyAndSalt(secret ?? this.#secret);

    const iv = randomBytes(this.#viByteLength);

    const cipher = createCipheriv(this.#algorithm, key, iv);

    const data = Buffer.concat([cipher.update(value), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.from(
      JSON.stringify({
        iv: iv.toString(this.#encoding),
        tag: tag.toString(this.#encoding),
        data: data.toString(this.#encoding),
        salt: salt.toString(this.#encoding),
      }),
    ).toString(this.#encoding);
  }

  /**
   * Decrypts an encrypted string value.
   * @param value - The base64-encoded encrypted string to decrypt
   * @param secret - Optional secret key to use instead of the default
   * @returns The decrypted plaintext string
   */
  async decrypt(value: string, secret?: string): Promise<string> {
    const payload: { iv: string; tag: string; data: string; salt: string } =
      JSON.parse(Buffer.from(value, this.#encoding).toString("utf8"));

    const key = (await promisify(scrypt)(
      secret ?? this.#secret,
      Buffer.from(payload.salt, this.#encoding),
      this.#keyByteLength,
    )) as Buffer;

    const iv = Buffer.from(payload.iv, this.#encoding);
    const tag = Buffer.from(payload.tag, this.#encoding);
    const data = Buffer.from(payload.data, this.#encoding);

    const decipher = createDecipheriv(this.#algorithm, key, iv);

    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  }

  async #getKeyAndSalt(secret: string): Promise<{ key: Buffer; salt: Buffer }> {
    const salt = randomBytes(this.#saltByteLength);

    return {
      key: (await promisify(scrypt)(
        secret,
        salt,
        this.#keyByteLength,
      )) as Buffer,
      salt,
    };
  }
}
