import {
  BaseEntity,
  Entity,
  Opt,
  PrimaryKey,
  Property,
  t,
  Unique,
} from "@mikro-orm/core";
import { randomUUID } from "crypto";

/**
 * Abstract base entity for user records.
 *
 * @remarks
 * Maps to the better-auth `user` model. Provides core identity fields
 * such as name, email, and avatar, intended to be extended by the application.
 */
@Entity({ abstract: true })
export class BaseUser extends BaseEntity {
  /** Primary key (UUID v4, auto-generated). */
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  /** Display name of the user. */
  @Property({ type: t.text })
  name!: string;

  /** Unique email address of the user. */
  @Property({ type: t.text })
  @Unique()
  email!: string;

  /** Whether the email address has been verified. */
  @Property({ type: t.boolean, default: false })
  emailVerified!: boolean;

  /** URL of the user's avatar image. */
  @Property({ type: t.text, nullable: true })
  image?: Opt<string>;

  /** Timestamp when the user was created. */
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
