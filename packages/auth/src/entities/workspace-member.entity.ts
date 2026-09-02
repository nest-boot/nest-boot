import { randomUUID } from "node:crypto";

import { BaseEntity, type Opt, type Ref, t } from "@mikro-orm/core";
import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
} from "@mikro-orm/decorators/legacy";

import type { BaseUser } from "./user.entity.js";
import type { BaseWorkspace } from "./workspace.entity.js";

/** Workspace roles understood by the built-in authorization services. */
export type AuthWorkspaceMemberRole = "ADMIN" | "MEMBER" | "OWNER";

/** Workspace-member states understood by the built-in authentication services. */
export type AuthWorkspaceMemberStatus =
  | "ACTIVE"
  | "DISABLED"
  | "INVITE_EXPIRED"
  | "INVITING";

/**
 * Abstract base entity for workspace-member records.
 *
 * @remarks
 * Provides the membership fields required by workspace and API-key
 * authorization. Applications may extend it with invitation or profile data.
 */
@Entity({ abstract: true })
export class BaseWorkspaceMember extends BaseEntity {
  /** Primary key (UUID v4, auto-generated). */
  @PrimaryKey({ type: t.uuid })
  id: Opt<string> = randomUUID();

  /** Member display name. */
  @Property({ type: t.text })
  name!: string;

  /** Member email address. */
  @Property({ type: t.text, nullable: true })
  email?: Opt<string> | null = null;

  /** Member role used by workspace and API-key authorization. */
  // eslint-disable-next-line @nest-boot/entity-property-config-from-types
  @Property({ type: t.string, default: "MEMBER" })
  role: Opt<AuthWorkspaceMemberRole> = "MEMBER";

  /** Member lifecycle status. */
  // eslint-disable-next-line @nest-boot/entity-property-config-from-types
  @Property({ type: t.string, default: "ACTIVE" })
  status: Opt<AuthWorkspaceMemberStatus> = "ACTIVE";

  /** Additional permissions granted inside the workspace. */
  @Property({ type: t.array })
  permissions: Opt<string[]> = [];

  /** Timestamp when the membership was created. */
  @Property({ type: t.datetime, defaultRaw: "now()" })
  createdAt: Opt<Date> = new Date();

  /** Timestamp of the last update. */
  @Property({
    type: t.datetime,
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();

  /** User associated with this member, when it represents a user. */
  @ManyToOne({
    entity: () => "User" as any,
    nullable: true,
    updateRule: "cascade",
    deleteRule: "cascade",
  })
  user?: Ref<BaseUser> | null;

  /** Workspace that owns this member. */
  @ManyToOne({
    entity: () => "Workspace" as any,
    updateRule: "cascade",
    deleteRule: "cascade",
  })
  workspace!: Ref<BaseWorkspace>;
}
