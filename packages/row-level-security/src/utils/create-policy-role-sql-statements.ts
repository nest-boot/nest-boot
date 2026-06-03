import { RowLevelSecurityRole } from "../enums/row-level-security-role.enum";
import { assertIdentifier } from "./assert-identifier";

/** Creates SQL for pre-created RLS roles. Roles are managed outside migrations. */
export function createPolicyRoleUpSqlStatements(roles: Iterable<string> = []) {
  getPolicyRoleNames(roles);

  return [];
}

/** Creates SQL for rolling back role bootstrap. Roles are managed outside migrations. */
export function createPolicyRoleDownSqlStatements(
  roles: Iterable<string> = [],
) {
  [...getExplicitPolicyRoleNames(roles)].sort();

  return [];
}

/** Returns unique policy roles, always including the anonymous fallback role. */
export function getPolicyRoleNames(roles: Iterable<string> = []) {
  const roleNames = getExplicitPolicyRoleNames(roles);

  roleNames.delete(RowLevelSecurityRole.ANONYMOUS);

  return [RowLevelSecurityRole.ANONYMOUS, ...[...roleNames].sort()];
}

/** Returns unique explicit policy roles without adding fallback roles. */
function getExplicitPolicyRoleNames(roles: Iterable<string>) {
  const roleNames = new Set<string>();

  for (const role of roles) {
    if (role.toLowerCase() === "public") {
      continue;
    }

    roleNames.add(assertIdentifier(role));
  }

  return roleNames;
}
