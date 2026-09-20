/* eslint-disable @nest-boot/graphql-field-config-from-types -- MikroORM Opt/Ref markers require explicit GraphQL metadata. */
import { BaseEntity, type Opt, type Ref, t } from "@mikro-orm/core";
import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from "@mikro-orm/decorators/legacy";
import { Field, HideField, ID, ObjectType } from "@nest-boot/graphql";
import { randomUUID } from "crypto";

import { userScopePolicy } from "../policies/user-scope.policy.js";
import { User } from "./user.entity.js";

/** Built-in Account entity with authentication persistence and access policies. */
@Entity({
  policies: [userScopePolicy({ property: "user", command: "select" })],
})
@ObjectType()
@Unique({ properties: ["issuer", "accountId"] })
export class Account extends BaseEntity {
  /** Primary key (UUID v4, auto-generated). */
  @PrimaryKey({ type: t.uuid })
  @Field(() => ID)
  id: Opt<string> = randomUUID();

  /** Provider-scoped account identifier. */
  @Property({ type: t.text })
  @Field(() => ID)
  accountId!: string;

  /** Stable issuer namespace used together with {@link accountId}. */
  @Property({ type: t.text })
  @Field(() => String)
  issuer!: string;

  /** Authentication provider identifier (e.g. `"google"`, `"credential"`). */
  @Property({ type: t.text })
  @Field(() => ID)
  providerId!: string;

  /** User that owns this record. */
  @Index()
  @ManyToOne(() => User, {
    fieldName: "user_id",
    ref: true,
    deleteRule: "cascade",
  })
  @HideField()
  user!: Ref<User>;

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
  @Property({
    type: t.datetime,
    defaultRaw: "now()",
  })
  @Field(() => Date)
  createdAt: Opt<Date> = new Date();

  /** Timestamp of the last update. */
  @Property({
    type: t.datetime,
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  @Field(() => Date)
  updatedAt: Opt<Date> = new Date();

  /** Granted OAuth scopes; credentials are intentionally not GraphQL fields. */
  @Field(() => [String])
  get scopes(): Opt<string[]> {
    return this.scope?.split(/[,\s]+/).filter(Boolean) ?? [];
  }
}
