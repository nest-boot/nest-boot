import { type Opt, type Ref, ref, Reference, t } from "@mikro-orm/core";
import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from "@mikro-orm/decorators/legacy";
import { SearchableProperty } from "@nest-boot/database";
import { Sonyflake } from "sonyflake-js";

import { User } from "../../core/entities/user.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { BaseApiKey } from "./base-api-key.entity.js";
import { SystemAccount } from "./system-account.entity.js";

/** Concrete identity types supported by the native polymorphic owner. */
export interface ApiKeyOwnerMap {
  user: User;
  workspace_member: WorkspaceMember;
  system_account: SystemAccount;
}

/** Native ORM record whose credential hash may be omitted from a query. */
export type ApiKeyRecord = Omit<ApiKey, "key">;

/** Persisted credential narrowed to one validated owner kind. */
export type OwnedApiKey<Kind extends keyof ApiKeyOwnerMap> = ApiKeyRecord & {
  readonly ownerType: Kind;
  owner: Ref<ApiKeyOwnerMap[Kind]>;
};

/** Shared credential entity with a feature-specific abstract owner mapping. */
@Entity()
@Index({ properties: ["owner"] })
@Index({ properties: ["key"] })
@Index({ properties: ["prefix"] })
@Index({ properties: ["createdAt"] })
export class ApiKey extends BaseApiKey {
  /**
   * Polymorphic owner discriminator, maintained by the owner relation.
   * @returns Concrete kind of the polymorphic credential owner.
   */
  @Property({ type: t.string, persist: false, fieldName: "owner_type" })
  get ownerType(): Opt<"user" | "workspace_member" | "system_account"> {
    const owner = Reference.unwrapReference<
      User | WorkspaceMember | SystemAccount
    >(this.owner);
    return owner instanceof User
      ? "user"
      : owner instanceof WorkspaceMember
        ? "workspace_member"
        : "system_account";
  }

  /**
   * Owning user exposed by the user-key management API.
   * @returns Owning user reference, or undefined for other owner kinds.
   */
  get user(): Ref<User> | undefined {
    return this.ownerType === "user" ? (this.owner as Ref<User>) : undefined;
  }

  set user(user: Ref<User> | User | undefined) {
    if (user) {
      this.owner = ref(User, user);
    }
  }

  /**
   * Owning member exposed by the member-key management API.
   * @returns Owning member reference, or undefined for other owner kinds.
   */
  get member(): Ref<WorkspaceMember> | undefined {
    return this.ownerType === "workspace_member"
      ? (this.owner as Ref<WorkspaceMember>)
      : undefined;
  }

  set member(member: Ref<WorkspaceMember> | WorkspaceMember | undefined) {
    if (member) {
      this.owner = ref(WorkspaceMember, member);
    }
  }

  /**
   * Owning system identity, absent for user and member keys.
   * @returns Owning system-account reference, or undefined for other owner kinds.
   */
  get systemAccount(): Ref<SystemAccount> | undefined {
    return this.ownerType === "system_account"
      ? (this.owner as Ref<SystemAccount>)
      : undefined;
  }

  /** Administrator or user recorded for audit, independent of credential ownership. */
  @ManyToOne(() => User, { ref: true, nullable: true, deleteRule: "set null" })
  createdBy?: Opt<Ref<User>> | null = null;

  /**
   * Identifier of the creator retained for audit until that user is deleted.
   * @returns Creator identifier, or null when it is unavailable.
   */
  get createdById(): Opt<string> | null {
    return this.createdBy?.id ?? null;
  }

  /**
   * Identifier used internally by system-account key authorization.
   * @returns Identifier of the system account owning the credential.
   */
  get systemAccountId(): Opt<string> {
    const account = this.systemAccount;
    if (!account) {
      throw new Error("API key has no system-account owner");
    }
    return account.id;
  }

  /**
   * Identifier used internally by member-key authorization.
   * @returns Identifier of the member owning the credential.
   */
  get memberId(): Opt<string> {
    const member = this.member;
    if (!member) {
      throw new Error("API key has no member owner");
    }
    return member.id;
  }

  /**
   * Workspace identifier used by member-key authorization conditions.
   * @returns Identifier of the owning member’s workspace.
   */
  get workspaceId(): Opt<string> {
    const member = this.member;
    if (!member) {
      throw new Error("API key has no member owner");
    }
    return Reference.unwrapReference(member).workspace.id;
  }

  /** Primary key (Sonyflake ID, auto-generated). */
  // eslint-disable-next-line @nest-boot/entity-property-config-from-types -- Preserve bigint storage and string hydration without inferred runtime types.
  @PrimaryKey({ type: new t.bigint("string"), autoincrement: true })
  id: Opt<string> = Sonyflake.next().toString();

  /** API-key display name. */
  @Property({ type: t.string })
  name!: string;

  /** Tokenized display name used only for indexed search. */
  @SearchableProperty({ properties: "name", nullable: true })
  searchableName?: string | null;

  /** Starting characters retained for recognition in user interfaces. */
  @Property({ type: t.string, nullable: true })
  start?: Opt<string> | null = null;

  /** Public prefix embedded in the plaintext key. */
  @Property({ type: t.string, nullable: true })
  prefix?: Opt<string> | null = null;

  /** SHA-256 hash of the complete plaintext API key. */
  @Property({ type: t.text, unique: true })
  key!: string;

  /** Permanent revocation timestamp; null means the key has not been revoked. */
  @Property({ type: t.datetime, nullable: true })
  revokedAt: Opt<Date> | null = null;

  /** Operations that this API key may perform. */
  @Property({ type: t.array, defaultRaw: "'{}'" })
  permissions: Opt<string[]> = [];

  /** Timestamp when the key was created. */
  @Property({ type: t.datetime, defaultRaw: "now()" })
  createdAt: Opt<Date> = new Date();

  /** Timestamp of the last update. */
  @Property({
    type: t.datetime,
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();

  /** Last successful usage timestamp. */
  @Property({ type: t.datetime, nullable: true })
  lastUsedAt?: Opt<Date> | null = null;

  /** Expiration timestamp; `null` means the key does not expire. */
  @Property({ type: t.datetime, nullable: true })
  expiresAt?: Opt<Date> | null = null;
}
