import {
  BaseEntity,
  type Opt,
  type PolicyCallback,
  type Ref,
  t,
} from "@mikro-orm/core";
import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from "@mikro-orm/decorators/legacy";
import { Field, HideField, ID, ObjectType } from "@nest-boot/graphql";
import { Sonyflake } from "sonyflake-js";

import { WorkspaceApiKeyPermission } from "../enums/workspace-api-key-permission.enum.js";
import { Workspace } from "./workspace.entity.js";

const matchesApiKeyOwner: PolicyCallback<WorkspaceApiKey> = (columns) =>
  `("${columns.workspace}" = nullif(current_setting('app.workspace.id', true), '')::bigint)`;

/** Built-in WorkspaceApiKey entity with authentication persistence and access policies. */
@ObjectType()
@Entity<typeof WorkspaceApiKey>({
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
export class WorkspaceApiKey extends BaseEntity {
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
  // eslint-disable-next-line @nest-boot/graphql-field-config-from-types -- Dynamic enums preserve the stored string array type.
  @Property({ type: t.array, defaultRaw: "'{}'" })
  @Field(() => [WorkspaceApiKeyPermission])
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

  /** Owning workspace; physical deletion cascades to its keys. */
  @Index()
  @ManyToOne(() => Workspace, { ref: true, deleteRule: "cascade" })
  @HideField()
  workspace!: Ref<Workspace>;

  /** Workspace identifier available to serialized authorization conditions. */
  @Field(() => ID)
  get workspaceId(): string {
    return this.workspace.id;
  }
}
