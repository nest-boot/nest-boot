import { EntitySchema, t } from "@mikro-orm/core";

import { workspaceScopePolicy } from "../../common/policies/workspace-scope.policy.js";
import { User } from "../../core/entities/user.entity.js";
import { InvitationStatus } from "../enums/invitation-status.enum.js";
import { Invitation } from "./invitation.entity.js";
import { Workspace } from "./workspace.entity.js";

/**
 * Defines invitation persistence and recipient visibility through the native schema API.
 * @param schema - Optional database schema containing Auth tables.
 * @returns Native schema bound to the Invitation class.
 */
export function createInvitationSchema(schema?: string) {
  const properties = {
    id: { type: t.uuid, primary: true },
    email: { type: t.string },
    roles: { type: t.array, defaultRaw: "'{member}'" },
    status: {
      enum: true,
      items: () => InvitationStatus,
      default: InvitationStatus.PENDING,
    },
    expiresAt: { type: t.datetime },
    createdAt: { type: t.datetime, defaultRaw: "now()" },
    inviter: {
      kind: "m:1" as const,
      entity: () => User,
      ref: true,
      updateRule: "cascade",
      deleteRule: "cascade",
    },
    workspace: {
      kind: "m:1" as const,
      entity: () => Workspace,
      ref: true,
      updateRule: "cascade",
      deleteRule: "cascade",
    },
    workspaceId: { type: t.bigint, persist: false, getter: true },
  } as const;
  return new EntitySchema<Pick<Invitation, keyof typeof properties>>({
    class: Invitation,
    ...(schema !== undefined ? { schema } : {}),
    indexes: [
      { properties: ["createdAt"] },
      { properties: ["email"] },
      { properties: ["status"] },
      { properties: ["workspace"] },
    ],
    uniques: [
      { properties: ["email", "workspace"], where: { status: "pending" } },
    ],
    policies: [
      workspaceScopePolicy(),
      {
        name: "invitation_recipient_select_policy",
        command: "select",
        roles: ["authenticated"],
        using: ({ email }, table) => {
          const users =
            table.schema && table.schema !== "public"
              ? `"${table.schema.replaceAll('"', '""')}"."user"`
              : '"user"';
          return `"${email}" = (select lower("recipient"."email") from ${users} as "recipient" where "recipient"."id" = nullif(current_setting('app.user.id', true), '')::bigint)`;
        },
      },
    ],
    properties,
  });
}

/** Complete invitation schema for direct ORM consumers. */
export const InvitationSchema = createInvitationSchema();
