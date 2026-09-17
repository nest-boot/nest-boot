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

import { InvitationStatus } from "../enums/invitation-status.enum.js";
import { workspaceScopePolicy } from "../policies/workspace-scope.policy.js";
import { User } from "./user.entity.js";
import { Workspace } from "./workspace.entity.js";

/** Workspace-invitation states understood by the built-in auth services. */
export type AuthInvitationStatus =
  | "accepted"
  | "canceled"
  | "pending"
  | "rejected";

/** Built-in Invitation entity with authentication persistence and access policies. */
@ObjectType()
@Entity({
  policies: [
    workspaceScopePolicy(),
    {
      name: "invitation_recipient_select_policy",
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
export class Invitation extends BaseEntity {
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
  @Property({
    type: t.array,
    defaultRaw: "'{member}'",
  })
  @Field(() => [String])
  roles: Opt<string[]> = ["member"];

  /** Invitation lifecycle status. */
  @Field(() => InvitationStatus)
  @Enum({
    items: () => InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: Opt<AuthInvitationStatus> = InvitationStatus.PENDING;

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
}
