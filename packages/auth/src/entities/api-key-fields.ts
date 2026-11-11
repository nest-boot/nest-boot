/* eslint-disable @nest-boot/graphql-field-config-from-types -- MikroORM Opt/Ref markers require explicit GraphQL metadata. */
import {
  BaseEntity,
  type Opt,
  type Ref,
  ref,
  Reference,
  t,
} from "@mikro-orm/core";
import {
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from "@mikro-orm/decorators/legacy";
import { Field, HideField, ID, ObjectType } from "@nest-boot/graphql";
import { Sonyflake } from "sonyflake-js";

import { Member } from "./member.entity.js";
import { SystemAccount } from "./system-account.entity.js";
import { User } from "./user.entity.js";

/** Shared metadata and owner accessors for the three credential views. */
@ObjectType({ isAbstract: true })
@Index({ properties: ["owner"] })
@Index({ properties: ["key"] })
@Index({ properties: ["prefix"] })
@Index({ properties: ["createdAt"] })
export abstract class ApiKeyFields extends BaseEntity {
  /**
   * Polymorphic owner discriminator, maintained by the owner relation.
   * @returns Concrete kind of the polymorphic credential owner.
   */
  @Property({ type: t.string, persist: false, fieldName: "owner_type" })
  @HideField()
  get ownerType(): Opt<"user" | "member" | "system_account"> {
    const owner = Reference.unwrapReference<User | Member | SystemAccount>(
      this.owner,
    );
    return owner instanceof User
      ? "user"
      : owner instanceof Member
        ? "member"
        : "system_account";
  }

  /** User, workspace member or independent system account that owns the credential. */
  @HideField()
  owner!: Ref<User | Member | SystemAccount>;

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
  get member(): Ref<Member> | undefined {
    return this.ownerType === "member"
      ? (this.owner as Ref<Member>)
      : undefined;
  }

  set member(member: Ref<Member> | Member | undefined) {
    if (member) {
      this.owner = ref(Member, member);
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
  @HideField()
  createdBy?: Opt<Ref<User>> | null = null;

  /**
   * Identifier of the creator retained for audit until that user is deleted.
   * @returns Creator identifier, or null when it is unavailable.
   */
  @Field(() => ID, { nullable: true })
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
  @Property({ type: t.array, defaultRaw: "'{}'" })
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
}
