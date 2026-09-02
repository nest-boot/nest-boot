import { BaseEntity, type Opt, t } from "@mikro-orm/core";
import {
  Entity,
  PrimaryKey,
  Property,
  Unique,
} from "@mikro-orm/decorators/legacy";
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

  /** User-administration and session permissions granted to this identity. */
  @Property({ type: t.array })
  permissions: Opt<string[]> = [];

  /** Whether the user is currently banned from authenticating. */
  @Property({ type: t.boolean, default: false })
  banned: Opt<boolean> = false;

  /** Administrative reason for the current ban. */
  @Property({ type: t.text, nullable: true })
  banReason?: Opt<string> | null = null;

  /** Time when the current ban expires; `null` means it is permanent. */
  @Property({ type: t.datetime, nullable: true })
  banExpiresAt?: Opt<Date> | null = null;

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
