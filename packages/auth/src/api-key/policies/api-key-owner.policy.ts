import type { PolicyCallback, PolicyDef } from "@mikro-orm/core";

/**
 * Restricts request-role access to user and selected-workspace credentials.
 * System credentials are managed exclusively through administrator-session services.
 * @param workspace - Whether member owners are registered.
 * @returns Identical owner predicates for reads and writes.
 */
export function apiKeyOwnerPolicy(workspace: boolean): PolicyDef {
  const predicate: PolicyCallback<object> = (_columns, table) => {
    const user = `("owner_type" = 'user' AND "owner_id" = nullif(current_setting('app.user.id', true), '')::bigint)`;
    const members =
      table.schema && table.schema !== "public"
        ? `"${table.schema.replaceAll('"', '""')}"."member"`
        : '"member"';
    return workspace
      ? `(${user} OR ("owner_type" = 'member' AND EXISTS (SELECT 1 FROM ${members} WHERE "member"."id" = "owner_id" AND "member"."workspace_id" = nullif(current_setting('app.workspace.id', true), '')::bigint)))`
      : user;
  };
  return {
    command: "all",
    roles: ["authenticated"],
    using: predicate,
    check: predicate,
  };
}
