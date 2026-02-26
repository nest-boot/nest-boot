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
 * Abstract entity representing a verification token.
 */
@Entity({ abstract: true })
export abstract class BaseVerification extends BaseEntity {
  /**
   * Unique identifier for the verification token.
   */
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  /**
   * Identifier (e.g., email or phone number).
   */
  @Property({ type: t.text })
  identifier!: string;

  /**
   * Verification value (token).
   */
  @Property({ type: t.text })
  value!: string;

  /**
   * Expiration date.
   */
  @Property({ type: t.datetime })
  expiresAt!: Date;

  /**
   * Creation date.
   */
  @Property({ type: t.datetime, defaultRaw: "now()" })
  createdAt: Opt<Date> = new Date();

  /**
   * Last update date.
   */
  @Property({
    type: t.datetime,
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();
}
