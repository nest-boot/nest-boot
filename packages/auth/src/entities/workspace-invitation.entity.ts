import { randomUUID } from "node:crypto";

import { BaseEntity, type Opt, type Ref, t } from "@mikro-orm/core";
import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from "@mikro-orm/decorators/legacy";

import type { BaseUser } from "./user.entity.js";
import type { BaseWorkspace } from "./workspace.entity.js";

/** Workspace-invitation states understood by the built-in auth services. */
export type AuthWorkspaceInvitationStatus =
  | "accepted"
  | "canceled"
  | "pending"
  | "rejected";

/**
 * Abstract base entity for workspace invitations.
 *
 * @remarks
 * An invitation remains separate from workspace membership throughout its
 * lifecycle. Accepting it creates a new workspace-member record.
 */
@Entity({ abstract: true })
@Unique({
  properties: ["email", "workspace"],
  where: { status: "pending" },
})
export class BaseWorkspaceInvitation extends BaseEntity {
  /** Primary key (UUID v4, auto-generated). */
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  /** Email address allowed to accept the invitation. */
  @Property({ type: t.text })
  email!: string;

  /** Roles granted to the member after acceptance. */
  @Property({ type: t.array })
  roles: Opt<string[]> = ["member"];

  /** Invitation lifecycle status. */
  // eslint-disable-next-line @nest-boot/entity-property-config-from-types
  @Property({ type: t.string, default: "pending" })
  status: Opt<AuthWorkspaceInvitationStatus> = "pending";

  /** Time after which the invitation can no longer be accepted. */
  @Property({ type: t.datetime })
  expiresAt!: Date;

  /** Timestamp when the invitation was created. */
  @Property({ type: t.datetime, defaultRaw: "now()" })
  createdAt: Opt<Date> = new Date();

  /** User that created the invitation. */
  @ManyToOne({
    entity: () => "User" as any,
    updateRule: "cascade",
    deleteRule: "cascade",
  })
  inviter!: Ref<BaseUser>;

  /** Workspace to which the recipient was invited. */
  @ManyToOne({
    entity: () => "Workspace" as any,
    updateRule: "cascade",
    deleteRule: "cascade",
  })
  workspace!: Ref<BaseWorkspace>;
}
