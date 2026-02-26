import {
  BaseEntity,
  Cascade,
  Entity,
  ManyToOne,
  Opt,
  PrimaryKey,
  Property,
  t,
} from "@mikro-orm/core";
import { randomUUID } from "crypto";

/**
 * Abstract entity representing an account.
 */
@Entity({ abstract: true })
export abstract class BaseAccount extends BaseEntity {
  /**
   * Unique identifier for the account.
   */
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  /**
   * Account ID provided by the authentication provider.
   */
  @Property({ type: t.text })
  accountId!: string;

  /**
   * Provider ID (e.g., google, github).
   */
  @Property({ type: t.text })
  providerId!: string;

  /**
   * User ID associated with the account.
   */
  @ManyToOne(() => "User", {
    fieldName: "user_id",
    mapToPk: true,
    cascade: [Cascade.REMOVE],
  })
  userId!: string;

  /**
   * Access token.
   */
  @Property({ type: t.text, nullable: true })
  accessToken?: Opt<string>;

  /**
   * Refresh token.
   */
  @Property({ type: t.text, nullable: true })
  refreshToken?: Opt<string>;

  /**
   * ID token.
   */
  @Property({ type: t.text, nullable: true })
  idToken?: Opt<string>;

  /**
   * Access token expiration date.
   */
  @Property({ type: t.datetime, nullable: true })
  accessTokenExpiresAt?: Opt<Date>;

  /**
   * Refresh token expiration date.
   */
  @Property({ type: t.datetime, nullable: true })
  refreshTokenExpiresAt?: Opt<Date>;

  /**
   * OAuth scope.
   */
  @Property({ type: t.text, nullable: true })
  scope?: Opt<string>;

  /**
   * Password (encrypted).
   */
  @Property({ type: t.text, nullable: true })
  password?: Opt<string>;

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
