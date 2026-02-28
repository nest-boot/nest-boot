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
 * Abstract base entity for OAuth/credential account records.
 *
 * @remarks
 * Maps to the better-auth `account` model. Each account links a provider
 * (e.g. Google, GitHub, credentials) to a {@link BaseUser}.
 */
@Entity({ abstract: true })
export abstract class BaseAccount extends BaseEntity {
  /** Primary key (UUID v4, auto-generated). */
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  /** Provider-scoped account identifier. */
  @Property({ type: t.text })
  accountId!: string;

  /** Authentication provider identifier (e.g. `"google"`, `"credential"`). */
  @Property({ type: t.text })
  providerId!: string;

  /** Foreign key referencing the owning {@link BaseUser}. */
  @ManyToOne(() => "User", {
    fieldName: "user_id",
    mapToPk: true,
    cascade: [Cascade.REMOVE],
  })
  userId!: string;

  /** OAuth access token, if available. */
  @Property({ type: t.text, nullable: true })
  accessToken?: Opt<string>;

  /** OAuth refresh token, if available. */
  @Property({ type: t.text, nullable: true })
  refreshToken?: Opt<string>;

  /** OpenID Connect ID token, if available. */
  @Property({ type: t.text, nullable: true })
  idToken?: Opt<string>;

  /** Expiration timestamp of the access token. */
  @Property({ type: t.datetime, nullable: true })
  accessTokenExpiresAt?: Opt<Date>;

  /** Expiration timestamp of the refresh token. */
  @Property({ type: t.datetime, nullable: true })
  refreshTokenExpiresAt?: Opt<Date>;

  /** OAuth scopes granted to this account. */
  @Property({ type: t.text, nullable: true })
  scope?: Opt<string>;

  /** Hashed password for credential-based accounts. */
  @Property({ type: t.text, nullable: true })
  password?: Opt<string>;

  /** Timestamp when the account was created. */
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
