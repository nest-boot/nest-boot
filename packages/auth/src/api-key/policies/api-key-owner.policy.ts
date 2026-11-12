import type { PolicyDef } from "@mikro-orm/core";

/**
 * Restricts request-role access to user and selected-workspace credentials.
 * System credentials are managed exclusively through administrator-session services.
 * @param workspace - Whether member owners are registered.
 * @returns Identical owner predicates for reads and writes.
 */
export function apiKeyOwnerPolicy(workspace: boolean): PolicyDef {
  const user = `("owner_type" = 'user' AND "owner_id" = nullif(current_setting('app.user.id', true), '')::bigint)`;
  const predicate = workspace
    ? `(${user} OR ("owner_type" = 'member' AND EXISTS (SELECT 1 FROM "member" WHERE "member"."id" = "owner_id" AND "member"."workspace_id" = nullif(current_setting('app.workspace.id', true), '')::bigint)))`
    : user;
  return {
    command: "all",
    roles: ["authenticated"],
    using: predicate,
    check: predicate,
  };
}
