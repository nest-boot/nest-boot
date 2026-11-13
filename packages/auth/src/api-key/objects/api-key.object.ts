import { type Ref, ref, Reference } from "@mikro-orm/core";
import { Field, HideField, ID, ObjectType } from "@nest-boot/graphql";

import { User } from "../../core/entities/user.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import type { ApiKey } from "../entities/api-key.entity.js";
import { SystemAccount } from "../entities/system-account.entity.js";

type ApiKeyData = Pick<
  ApiKey,
  | "id"
  | "name"
  | "start"
  | "prefix"
  | "revokedAt"
  | "permissions"
  | "createdAt"
  | "updatedAt"
  | "lastUsedAt"
  | "expiresAt"
  | "createdById"
  | "owner"
>;

/** Public credential metadata, independent of ORM persistence and credential hashes. */
@ObjectType({ isAbstract: true })
export abstract class ApiKeyObject {
  /** Stable credential identifier. */
  @Field(() => ID)
  declare id: string;
  /** Display name. */
  @Field(() => String)
  declare name: string;
  /** Recognizable beginning of the credential. */
  @Field(() => String, { nullable: true })
  declare start?: string | null;
  /** Public credential prefix. */
  @Field(() => String, { nullable: true })
  declare prefix?: string | null;
  /** Permanent revocation timestamp. */
  @Field(() => Date, { nullable: true })
  declare revokedAt: Date | null;
  /** Owner-specific grants, exposed with the concrete DTO's enum. */
  @HideField()
  declare permissions: string[];
  /** Credential creation time. */
  @Field(() => Date)
  declare createdAt: Date;
  /** Last metadata change. */
  @Field(() => Date)
  declare updatedAt: Date;
  /** Last successful use. */
  @Field(() => Date, { nullable: true })
  declare lastUsedAt?: Date | null;
  /** Optional expiration. */
  @Field(() => Date, { nullable: true })
  declare expiresAt?: Date | null;
  /** Creator identifier retained while the creating user exists. */
  @Field(() => ID, { nullable: true })
  declare createdById: string | null;
  /** Internal reference for authorized identity resolution; never exposed as a GraphQL owner union. */
  @HideField()
  declare owner: Ref<User | WorkspaceMember | SystemAccount>;

  /**
   * Copies only public metadata and the internal identity reference.
   * @param data - Persisted credential metadata, when constructing a response.
   */
  constructor(data?: ApiKeyData) {
    if (data) {
      const {
        id,
        name,
        start,
        prefix,
        revokedAt,
        createdAt,
        updatedAt,
        lastUsedAt,
        expiresAt,
        createdById,
        owner,
      } = data;
      Object.assign(this, {
        id,
        name,
        start,
        prefix,
        revokedAt,
        createdAt,
        updatedAt,
        lastUsedAt,
        expiresAt,
        createdById,
        owner,
        permissions: [...data.permissions],
      });
    }
  }

  /**
   * Concrete kind of the internal identity reference.
   * @returns Value for the credential identity or authorization condition.
   */
  @HideField()
  abstract readonly ownerType: "user" | "workspace_member" | "system_account";
  /**
   * User identity available to internal authorization.
   * @returns Value for the credential identity or authorization condition.
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
   * Workspace member identity available to internal authorization.
   * @returns Value for the credential identity or authorization condition.
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
   * System identity available to internal authorization.
   * @returns Value for the credential identity or authorization condition.
   */
  get systemAccount(): Ref<SystemAccount> | undefined {
    return this.ownerType === "system_account"
      ? (this.owner as Ref<SystemAccount>)
      : undefined;
  }
  /**
   * Identifier used internally by member-key conditions.
   * @returns Value for the credential identity or authorization condition.
   */
  get memberId(): string {
    if (!this.member) {
      throw new Error("API key has no member owner");
    }
    return this.member.id;
  }
  /**
   * Workspace used internally by member-key conditions.
   * @returns Value for the credential identity or authorization condition.
   */
  get workspaceId(): string {
    if (!this.member) {
      throw new Error("API key has no member owner");
    }
    return Reference.unwrapReference(this.member).workspace.id;
  }
  /**
   * Identifier used internally by system-key conditions.
   * @returns Value for the credential identity or authorization condition.
   */
  get systemAccountId(): string {
    if (!this.systemAccount) {
      throw new Error("API key has no system-account owner");
    }
    return this.systemAccount.id;
  }
}
