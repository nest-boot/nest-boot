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
 * Abstract entity representing a user.
 */
@Entity({ abstract: true })
export class BaseUser extends BaseEntity {
  /**
   * Unique identifier for the user.
   */
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  /**
   * User's name.
   */
  @Property({ type: t.text })
  name!: string;

  /**
   * User's email address.
   */
  @Property({ type: t.text })
  @Unique()
  email!: string;

  /**
   * Whether the email has been verified.
   */
  @Property({ type: t.boolean, default: false })
  emailVerified!: boolean;

  /**
   * URL to the user's profile image.
   */
  @Property({ type: t.text, nullable: true })
  image?: Opt<string>;

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
