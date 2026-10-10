/* eslint-disable @nest-boot/graphql-field-config-from-types -- MikroORM Opt/Ref markers require explicit GraphQL metadata. */
import { BaseEntity, type Opt, type Ref, t } from "@mikro-orm/core";
import {
  Check,
  Entity,
  Enum,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from "@mikro-orm/decorators/legacy";
import { Field, ID, ObjectType } from "@nest-boot/graphql";
import { Sonyflake } from "sonyflake-js";

import { MemberStatus } from "../enums/member-status.enum.js";
import { MemberType } from "../enums/member-type.enum.js";
import { WorkspacePermission } from "../enums/workspace-permission.enum.js";
import { WorkspaceRole } from "../enums/workspace-role.enum.js";
import { userScopePolicy } from "../policies/user-scope.policy.js";
import { workspaceScopePolicy } from "../policies/workspace-scope.policy.js";
import { User } from "./user.entity.js";
import { Workspace } from "./workspace.entity.js";

/** Workspace-member states understood by the built-in authentication services. */
export type AuthMemberStatus = "ACTIVE" | "DISABLED";

/** Identity kinds supported by workspace members. */
export type AuthMemberType = "USER" | "SERVICE_ACCOUNT";

/** Built-in Member entity with authentication persistence and access policies. */
@ObjectType()
@Entity({
  policies: [
    // Allow users to read their own memberships across workspaces without granting writes.
    userScopePolicy({ command: "select" }),
    workspaceScopePolicy(),
  ],
})
@Check<typeof Member>({
  name: "member_type_user_check",
  expression: (columns) =>
    `("${columns.type}" = 'USER' AND "${columns.user}" IS NOT NULL) OR ("${columns.type}" = 'SERVICE_ACCOUNT' AND "${columns.user}" IS NULL)`,
})
@Unique({ properties: ["user", "workspace"] })
@Index({ properties: ["createdAt"] })
@Index({ properties: ["user"] })
@Index({ properties: ["workspace"] })
export class Member extends BaseEntity {
  /** Primary key (Sonyflake ID, auto-generated). */
  @PrimaryKey({
    type: t.bigint,
  })
  @Field(() => ID)
  id: Opt<string> = Sonyflake.next().toString();

  /** Display name shared inside this workspace, independent of the user profile. */
  @Property({ type: t.string })
  @Field(() => String)
  name!: string;

  /** Non-unique contact email shared inside this workspace, independent of login identity. */
  @Property({ type: t.string, nullable: true })
  @Field(() => String, { nullable: true })
  email?: Opt<string> | null = null;

  /** Member roles used to resolve workspace permissions. */
  @Property({ type: t.array, defaultRaw: "'{member}'" })
  @Field(() => [WorkspaceRole])
  roles: Opt<string[]> = ["member"];

  /** Whether this member represents a login user or a service account. */
  @Field(() => MemberType)
  @Enum({ items: () => MemberType, default: MemberType.USER })
  type: Opt<AuthMemberType> = MemberType.USER;

  /** Member lifecycle status. */
  @Field(() => MemberStatus)
  @Enum({
    items: () => MemberStatus,
    default: MemberStatus.ACTIVE,
  })
  status: Opt<AuthMemberStatus> = MemberStatus.ACTIVE;

  /** Additional permissions granted inside the workspace. */
  @Property({ type: t.array, defaultRaw: "'{}'" })
  @Field(() => [WorkspacePermission])
  permissions: Opt<string[]> = [];

  /** Timestamp when the membership was created. */
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

  /** Login user; service accounts have no user. */
  @ManyToOne(() => User, {
    nullable: true,
    updateRule: "cascade",
    deleteRule: "cascade",
  })
  user?: Ref<User> | null;

  /** Workspace that owns this member. */
  @ManyToOne(() => Workspace, {
    updateRule: "cascade",
    deleteRule: "cascade",
  })
  workspace!: Ref<Workspace>;

  /**
   * Workspace identifier available to serialized authorization conditions.
   * @returns Identifier of the associated workspace.
   */
  @Field(() => ID)
  get workspaceId(): Opt<string> {
    return this.workspace.id;
  }
}
