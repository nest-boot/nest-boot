import {
  BaseEntity,
  type Opt,
  type Ref,
  ref,
  Reference,
} from "@mikro-orm/core";
import { Sonyflake } from "sonyflake-js";

import { User } from "../../core/entities/user.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
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

/** Credential persistence model, mapped by the native ApiKeySchema. */

export class ApiKey extends BaseEntity {
  /**
   * Polymorphic owner discriminator, maintained by the owner relation.
   * @returns Concrete kind of the polymorphic credential owner.
   */
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

  /** User, workspace member or independent system account that owns the credential. */
  owner!: Ref<User | WorkspaceMember | SystemAccount>;

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
  id: Opt<string> = Sonyflake.next().toString();

  /** API-key display name. */
  name!: string;

  /** Tokenized display name used only for indexed search. */
  searchableName?: string | null;

  /** Starting characters retained for recognition in user interfaces. */
  start?: Opt<string> | null = null;

  /** Public prefix embedded in the plaintext key. */
  prefix?: Opt<string> | null = null;

  /** SHA-256 hash of the complete plaintext API key. */
  key!: string;

  /** Permanent revocation timestamp; null means the key has not been revoked. */
  revokedAt: Opt<Date> | null = null;

  /** Operations that this API key may perform. */
  permissions: Opt<string[]> = [];

  /** Timestamp when the key was created. */
  createdAt: Opt<Date> = new Date();

  /** Timestamp of the last update. */
  updatedAt: Opt<Date> = new Date();

  /** Last successful usage timestamp. */
  lastUsedAt?: Opt<Date> | null = null;

  /** Expiration timestamp; `null` means the key does not expire. */
  expiresAt?: Opt<Date> | null = null;
}
