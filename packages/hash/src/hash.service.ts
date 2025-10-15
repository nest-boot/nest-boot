import { Inject, Injectable, Optional } from "@nestjs/common";
import { hash, verify } from "@node-rs/argon2";

import { MODULE_OPTIONS_TOKEN } from "./hash.module-definition";
import { HashModuleOptions } from "./hash-module-options.interface";

@Injectable()
export class HashService {
  private readonly secret?: Buffer;

  constructor(
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: HashModuleOptions = {},
  ) {
    const secret =
      options.secret ?? process.env.HASH_SECRET ?? process.env.APP_SECRET;

    if (secret) {
      this.secret = Buffer.from(secret);
    }
  }

  async create(value: string | Buffer, secret?: string): Promise<string> {
    return await hash(value, {
      secret: typeof secret !== "undefined" ? Buffer.from(secret) : this.secret,
    });
  }

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
