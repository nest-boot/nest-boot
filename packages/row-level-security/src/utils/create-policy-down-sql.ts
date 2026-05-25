import type { PolicySqlOptions } from "../interfaces/policy-sql-options.interface";
import { assertIdentifier } from "./assert-identifier";
import { quoteQualifiedIdentifier } from "./quote-qualified-identifier";

export function createPolicyDownSql(options: PolicySqlOptions) {
  const tableIdentifier = quoteQualifiedIdentifier(
    options.schemaName,
    options.tableName,
  );
  const policyName = assertIdentifier(options.policyName);

  return /* SQL */ `
do $$
declare
  policy_count integer;
begin
  if to_regclass('${tableIdentifier}') is not null then
    execute 'drop policy if exists ${policyName} on ${tableIdentifier}';

    select count(*) into policy_count
    from pg_policies
    where schemaname = '${options.schemaName}' and tablename = '${options.tableName}';

    if policy_count = 0 then
      execute 'alter table ${tableIdentifier} disable row level security';
    end if;
  end if;
end
$$;
`.trim();
}
