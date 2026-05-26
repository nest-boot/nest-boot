import { RowLevelSecurityRole } from "../enums/row-level-security-role.enum";
import { assertIdentifier } from "./assert-identifier";
import { escapeSqlLiteral } from "./escape-sql-literal";

/** Creates SQL that ensures RLS roles and grants required runtime privileges. */
export function createPolicyRoleUpSqlStatements(roles: Iterable<string> = []) {
  return getPolicyRoleNames(roles).flatMap((role) => {
    const roleName = assertIdentifier(role);
    const roleLiteral = escapeSqlLiteral(roleName);

    return [
      `do $$ begin if not exists (select 1 from pg_roles where rolname = '${roleLiteral}') then create role ${roleName} nologin; end if; end $$;`,
      `grant ${roleName} to current_user;`,
      `grant usage on schema app to ${roleName};`,
    ];
  });
}

/** Creates SQL that revokes grants emitted by {@link createPolicyRoleUpSqlStatements}. */
export function createPolicyRoleDownSqlStatements(
  roles: Iterable<string> = [],
) {
  return getPolicyRoleNames(roles).flatMap((role) => {
    const roleName = assertIdentifier(role);

    return [
      `revoke usage on schema app from ${roleName};`,
      `revoke ${roleName} from current_user;`,
    ];
  });
}

/** Returns unique policy roles, always including the anonymous fallback role. */
export function getPolicyRoleNames(roles: Iterable<string> = []) {
  const roleNames = new Set<string>();

  for (const role of roles) {
    if (role.toLowerCase() === "public") {
      continue;
    }

    roleNames.add(assertIdentifier(role));
  }

  roleNames.delete(RowLevelSecurityRole.ANONYMOUS);

  return [RowLevelSecurityRole.ANONYMOUS, ...[...roleNames].sort()];
}
