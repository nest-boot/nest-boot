import { BaseEntity, type Opt, t } from "@mikro-orm/core";
import {
  Entity,
  Index,
  PrimaryKey,
  Property,
} from "@mikro-orm/decorators/legacy";
import { randomUUID } from "crypto";

/** Built-in Verification entity with authentication persistence and access policies. */
@Entity({
  policies: [
    {
      command: "all",
      roles: ["anonymous", "authenticated"],
      using: () => "false",
      check: () => "false",
    },
  ],
})
export class Verification extends BaseEntity {
  /** Primary key (UUID v4, auto-generated). */
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  /** Identifier associated with this verification (e.g. email address). */
  @Index()
  @Property({ type: t.text })
  identifier!: string;

  /** Verification token value. */
  @Property({ type: t.text })
  value!: string;

  /** Timestamp when this verification expires. */
  @Property({ type: t.datetime })
  expiresAt!: Date;

  /** Timestamp when the verification was created. */
  @Property({ type: t.datetime, defaultRaw: "now()" })
  createdAt: Opt<Date> = new Date();

  /** Timestamp of the last update. */
  @Property({
    type: t.datetime,
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();
}
