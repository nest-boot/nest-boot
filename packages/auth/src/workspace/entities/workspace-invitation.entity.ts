/* eslint-disable @nest-boot/graphql-field-config-from-types -- MikroORM Opt/Ref markers require explicit GraphQL metadata. */
import { randomUUID } from "node:crypto";

import { BaseEntity, type Opt, type Ref, t } from "@mikro-orm/core";
import {
  Entity,
  Enum,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from "@mikro-orm/decorators/legacy";
import { Field, ID, ObjectType } from "@nest-boot/graphql";

import { workspaceScopePolicy } from "../../common/policies/workspace-scope.policy.js";
import { User } from "../../core/entities/user.entity.js";
import { WorkspaceInvitationStatus } from "../enums/workspace-invitation-status.enum.js";
import { WorkspaceRole } from "../enums/workspace-role.enum.js";
import { Workspace } from "./workspace.entity.js";

/** Workspace-invitation states understood by the built-in auth services. */
export type AuthWorkspaceInvitationStatus =
  | "accepted"
  | "canceled"
  | "pending"
  | "rejected";

/** Built-in WorkspaceInvitation entity with authentication persistence and access policies. */
@ObjectType({ isAbstract: true })
@Entity({
  policies: [
    workspaceScopePolicy(),
    {
      name: "workspace_invitation_recipient_select_policy",
      command: "select",
      roles: ["authenticated"],
      // Recipients need not be workspace members; this policy grants reads only, not writes.
      using: ({ email }) =>
        `"${email}" = (select lower("recipient"."email") from "user" as "recipient" where "recipient"."id" = nullif(current_setting('app.user.id', true), '')::bigint)`,
    },
  ],
})
@Index({ properties: ["createdAt"] })
@Index({ properties: ["email"] })
@Index({ properties: ["status"] })
@Index({ properties: ["workspace"] })
@Unique({
  properties: ["email", "workspace"],
  where: { status: "pending" },
})
export class WorkspaceInvitation extends BaseEntity {
  /** Primary key (UUID v4, auto-generated). */
  @PrimaryKey({ type: t.uuid })
  @Field(() => ID)
  id: Opt<string> = randomUUID();

  /** Email address allowed to accept the invitation. */
  @Property({
    type: t.string,
  })
  @Field(() => String)
  email!: string;

  /** Roles granted to the member after acceptance. */
  @Property({ type: t.array, defaultRaw: "'{member}'" })
  @Field(() => [WorkspaceRole])
  roles: Opt<string[]> = ["member"];

  /** WorkspaceInvitation lifecycle status. */
  @Field(() => WorkspaceInvitationStatus)
  @Enum({
    items: () => WorkspaceInvitationStatus,
    default: WorkspaceInvitationStatus.PENDING,
  })
  status: Opt<AuthWorkspaceInvitationStatus> =
    WorkspaceInvitationStatus.PENDING;

  /** Time after which the invitation can no longer be accepted. */
  @Property({
    type: t.datetime,
  })
  @Field(() => Date)
  expiresAt!: Date;

  /** Timestamp when the invitation was created. */
  @Property({
    type: t.datetime,
    defaultRaw: "now()",
  })
  @Field(() => Date)
  createdAt: Opt<Date> = new Date();

  /** User that created the invitation. */
  @ManyToOne(() => User, {
    updateRule: "cascade",
    deleteRule: "cascade",
  })
  inviter!: Ref<User>;

  /** Workspace to which the recipient was invited. */
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
