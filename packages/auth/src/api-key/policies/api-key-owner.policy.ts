import type { PolicyDef } from "@mikro-orm/core";

/**
 * Restricts request-role access to user and selected-workspace credentials.
 * System credentials are managed exclusively through administrator-session services.
 * @param workspace - Whether member owners are registered.
 * @returns Identical owner predicates for reads and writes.
 */
export function apiKeyOwnerPolicy(workspace: boolean): PolicyDef {
  const user = `("owner_type" = 'user' AND "owner_id" = nullif(current_setting('app.auth.user.id', true), '')::bigint)`;
  const predicate = workspace
    ? `(${user} OR ("owner_type" = 'workspace_member' AND nullif(current_setting('app.auth.workspace_member.id', true), '') IS NOT NULL AND EXISTS (SELECT 1 FROM "workspace_member" WHERE "workspace_member"."id" = "owner_id" AND "workspace_member"."workspace_id" = nullif(current_setting('app.auth.workspace.id', true), '')::bigint)))`
    : user;
  return {
    command: "all",
    roles: ["authenticated"],
    using: predicate,
    check: predicate,
  };
}
