/* eslint-disable @nest-boot/graphql-field-config-from-types -- MikroORM Opt/Ref markers require explicit GraphQL metadata. */
import { randomUUID } from "node:crypto";

import { BaseEntity, type Opt, type Ref } from "@mikro-orm/core";
import { Field, ID, ObjectType } from "@nest-boot/graphql";

import { User } from "../../core/entities/user.entity.js";
import { InvitationStatus } from "../enums/invitation-status.enum.js";
import { WorkspaceRole } from "../enums/workspace-role.enum.js";
import { Workspace } from "./workspace.entity.js";

/** Workspace-invitation states understood by the built-in auth services. */
export type AuthInvitationStatus =
  | "accepted"
  | "canceled"
  | "pending"
  | "rejected";

/** Built-in Invitation entity with authentication persistence and access policies. */
@ObjectType({ isAbstract: true })
export class Invitation extends BaseEntity {
  /** Primary key (UUID v4, auto-generated). */

  @Field(() => ID)
  id: Opt<string> = randomUUID();

  /** Email address allowed to accept the invitation. */

  @Field(() => String)
  email!: string;

  /** Roles granted to the member after acceptance. */

  @Field(() => [WorkspaceRole])
  roles: Opt<string[]> = ["member"];

  /** Invitation lifecycle status. */
  @Field(() => InvitationStatus)
  status: Opt<AuthInvitationStatus> = InvitationStatus.PENDING;

  /** Time after which the invitation can no longer be accepted. */

  @Field(() => Date)
  expiresAt!: Date;

  /** Timestamp when the invitation was created. */

  @Field(() => Date)
  createdAt: Opt<Date> = new Date();

  /** User that created the invitation. */ inviter!: Ref<User>;

  /** Workspace to which the recipient was invited. */ workspace!: Ref<Workspace>;

  /**
   * Workspace identifier available to serialized authorization conditions.
   * @returns Identifier of the associated workspace.
   */
  @Field(() => ID)
  get workspaceId(): Opt<string> {
    return this.workspace.id;
  }
}
