import {
  BaseEntity,
  type Opt,
  type PolicyCallback,
  type Ref,
  t,
} from "@mikro-orm/core";
import {
  Check,
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from "@mikro-orm/decorators/legacy";
import { Field, HideField, ID, ObjectType } from "@nest-boot/graphql";
import { Sonyflake } from "sonyflake-js";

import { User } from "./user.entity.js";
import { Workspace } from "./workspace.entity.js";

const matchesApiKeyOwner: PolicyCallback<ApiKey> = (columns) => {
  return `("${columns.user}" = nullif(current_setting('app.user.id', true), '')::bigint)
    or ("${columns.workspace}" = nullif(current_setting('app.workspace.id', true), '')::bigint)`;
};

/** Built-in ApiKey entity with authentication persistence and access policies. */
@ObjectType()
@Entity<typeof ApiKey>({
  policies: [
    {
      command: "all",
      roles: ["authenticated"],
      using: matchesApiKeyOwner,
      check: matchesApiKeyOwner,
    },
  ],
})
@Index({ properties: ["key"] })
@Index({ properties: ["prefix"] })
@Index({ properties: ["createdAt"] })
@Check<typeof ApiKey>({
  expression: ({ user, workspace }) =>
    `("${user}" is not null) <> ("${workspace}" is not null)`,
})
export class ApiKey extends BaseEntity {
  /** Primary key (Sonyflake ID, auto-generated). */
  @PrimaryKey({
    type: t.bigint,
  })
  @Field(() => ID)
  id: Opt<string> = Sonyflake.next().toString();

  /** API-key display name. */
  @Property({ type: t.string })
  @Field(() => String)
  name!: string;

  /** Starting characters retained for recognition in user interfaces. */
  @Property({ type: t.string, nullable: true })
  @Field(() => String, { nullable: true })
  start?: Opt<string> | null = null;

  /** Public prefix embedded in the plaintext key. */
  @Property({
    type: t.string,
    nullable: true,
  })
  @Field(() => String, { nullable: true })
  prefix?: Opt<string> | null = null;

  /** SHA-256 hash of the complete plaintext API key. */
  @Property({
    type: t.text,
  })
  @Unique()
  @HideField()
  key!: string;

  /** Whether the key can authenticate requests. */
  @Property({
    type: t.boolean,
    default: true,
  })
  @Field(() => Boolean)
  enabled: Opt<boolean> = true;

  /** Operations that this API key may perform. */
  @Property({
    type: t.array,
    defaultRaw: "'{}'",
  })
  @Field(() => [String])
  permissions: Opt<string[]> = [];

  /** Timestamp when the key was created. */
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

  /** Last successful usage timestamp. */
  @Property({
    type: t.datetime,
    nullable: true,
  })
  @Field(() => Date, { nullable: true })
  lastUsedAt?: Opt<Date> | null = null;

  /** Expiration timestamp; `null` means the key does not expire. */
  @Property({
    type: t.datetime,
    nullable: true,
  })
  @Field(() => Date, { nullable: true })
  expiresAt?: Opt<Date> | null = null;

  /** Owning user; exactly one of user and workspace must be set. */
  @Index()
  @ManyToOne(() => User, { nullable: true, deleteRule: "cascade" })
  @HideField()
  user: Opt<Ref<User>> | null = null;

  /** Owning workspace; deleting a workspace physically also deletes its keys. */
  @Index()
  @ManyToOne(() => Workspace, { nullable: true, deleteRule: "cascade" })
  @HideField()
  workspace: Opt<Ref<Workspace>> | null = null;
}
