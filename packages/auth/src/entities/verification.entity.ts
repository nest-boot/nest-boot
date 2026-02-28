import {
  BaseEntity,
  Entity,
  Opt,
  PrimaryKey,
  Property,
  t,
} from "@mikro-orm/core";
import { randomUUID } from "crypto";

/**
 * Abstract base entity for verification records.
 *
 * @remarks
 * Used for email verification tokens, password reset tokens, and similar
 * time-limited verification flows managed by better-auth.
 */
@Entity({ abstract: true })
export abstract class BaseVerification extends BaseEntity {
  /** Primary key (UUID v4, auto-generated). */
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  /** Identifier associated with this verification (e.g. email address). */
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
