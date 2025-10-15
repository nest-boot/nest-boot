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

@Injectable()
export class CryptService {
  readonly #algorithm = "aes-256-gcm";

  readonly #encoding: Encoding = "base64";

  readonly #keyByteLength: number = 32;

  readonly #saltByteLength: number = 16;

  readonly #viByteLength: number = 16;

  readonly #secret: string;

  constructor(
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: CryptModuleOptions = {},
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
