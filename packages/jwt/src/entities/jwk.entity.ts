import { randomUUID } from "node:crypto";

import { type Opt, t } from "@mikro-orm/core";
import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";
import type { JWK } from "jose";

import type { JwtAlgorithm } from "../interfaces/jwks-options.interface.js";

@Entity()
export class Jwk {
  /** Primary key (UUID v4, auto-generated). */
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  /** Public JWK including its JWS `alg` parameter. */
  @Property({ type: t.json })
  publicKey!: JWK & { alg: JwtAlgorithm };

  /** Encrypted private key material. */
  @Property({ type: t.text, hidden: true })
  privateKey!: string;

  /** Timestamp when the key was created. */
  @Property({ type: t.datetime, defaultRaw: "now()" })
  createdAt: Opt<Date> = new Date();

  /** When this key stops signing new tokens. */
  @Property({ type: t.datetime })
  expiresAt!: Date;
}
