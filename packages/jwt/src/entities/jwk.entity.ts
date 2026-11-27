import { t } from "@mikro-orm/core";
import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";
import type { JWK } from "jose";

@Entity()
export class Jwk {
  @PrimaryKey({ type: t.text })
  id!: string;

  @Property({ type: t.json })
  publicKey!: JWK & { alg: string };

  @Property({ type: t.text, hidden: true })
  privateKey!: string;

  @Property({ type: t.datetime })
  createdAt!: Date;

  /** When this key stops signing new tokens. */
  @Property({ type: t.datetime, nullable: true })
  expiresAt!: Date | null;
}
