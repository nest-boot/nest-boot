import { RequestContext } from "@nest-boot/request-context";

import { RowLevelSecurityRole } from "../enums/row-level-security-role.enum";
import { RowLevelSecurity, RowLevelSecurityMode } from "../row-level-security";
import { assertSnakeCase } from "./assert-snake-case";
import { RowLevelSecurityContextBuilder } from "./row-level-security-context-builder";
import { RowLevelSecurityContextValue } from "./row-level-security-context-builder.types";

/** SQL and cache key for applying row level security on a transaction. */
export interface RowLevelSecurityTransactionSetup {
  /** Transaction-local SQL that applies the PostgreSQL role and context settings. */
  sql: string;
  /** Stable cache key used to skip repeated setup on the same transaction. */
  signature: string;
}

/** Creates transaction-local SQL for the current row level security context. */
export function createRowLevelSecurityTransactionSetup():
  | RowLevelSecurityTransactionSetup
  | undefined {
  if (!RequestContext.isActive()) {
    return;
  }

  const builder = new RowLevelSecurityContextBuilder();
  const mode = RowLevelSecurity.getMode();
  const contextEntries = RowLevelSecurity.entries();
  const role = RowLevelSecurity.getRole();

  if (mode === RowLevelSecurityMode.DISABLED) {
    return;
  }

  if (
    mode === RowLevelSecurityMode.AUTO &&
    !role &&
    contextEntries.length === 0
  ) {
    return;
  }

  appendContext(builder, contextEntries);
  const databaseRole = role ?? RowLevelSecurityRole.ANONYMOUS;
  assertSnakeCase(databaseRole, "Row level security database role");

  const contextSql = builder.entries().length > 0 ? builder.toSQL() : "";
  const sql = [/* SQL */ `SET LOCAL ROLE ${databaseRole};`, contextSql]
    .filter(Boolean)
    .join("\n");
  const signature = JSON.stringify({
    context: builder.entries(),
    role: databaseRole,
  });

  return {
    signature,
    sql,
  };
}

function appendContext(
  builder: RowLevelSecurityContextBuilder,
  context:
    | Iterable<readonly [string, RowLevelSecurityContextValue]>
    | undefined,
) {
  for (const [key, value] of context ?? []) {
    builder.set(key, value);
  }
}
