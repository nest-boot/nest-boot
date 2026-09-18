/** Uses credential-limited grants computed by auth in the trusted request context. */
export const userManagementPredicate = (
  permissions: readonly string[],
): string =>
  `jsonb_exists_any(coalesce(nullif(current_setting('app.user.permissions', true), ''), '[]')::jsonb, array[${permissions.map((p) => `'${p.replaceAll("'", "''")}'`).join(", ")}]::text[])`;

/** User administration is distinct from self-service profile updates. */
export const userUpdatePredicate = `id = nullif(current_setting('app.user.id', true), '')::bigint or ${userManagementPredicate(["user:update", "user:set-role", "user:set-email"])}`;

/** Only an authorized user administrator may physically delete a user. */
export const userDeletePredicate = userManagementPredicate(["user:delete"]);
