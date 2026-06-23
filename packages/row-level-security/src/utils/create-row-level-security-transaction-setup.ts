import { RequestContext } from "@nest-boot/request-context";

import { RowLevelSecurityRole } from "../enums/row-level-security-role.enum.js";
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "../row-level-security.js";
import { assertSnakeCase } from "./assert-snake-case.js";
import { RowLevelSecurityContextBuilder } from "./row-level-security-context-builder.js";
import { RowLevelSecurityContextValue } from "./row-level-security-context-builder.types.js";

/** Instruction for row level security transaction setup. */
export type RowLevelSecurityTransactionSetup =
  | RowLevelSecurityApplyTransactionSetup
  | RowLevelSecurityClearTransactionSetup;

/** SQL and cache key for applying row level security on a transaction. */
export interface RowLevelSecurityApplyTransactionSetup {
  /** Applies row level security state to the transaction. */
  action: "apply";
  /** Transaction-local SQL that applies the PostgreSQL role and context settings. */
  sql: string;
  /** Stable cache key used to skip repeated setup on the same transaction. */
  signature: string;
  /** Context setting keys emitted by this setup. */
  contextKeys: string[];
}

/** Instruction to clear previously applied row level security state. */
export interface RowLevelSecurityClearTransactionSetup {
  /** Clears row level security state previously applied to the transaction. */
  action: "clear";
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
    return {
      action: "clear",
    };
  }

  if (
    mode === RowLevelSecurityMode.AUTO &&
    !role &&
    contextEntries.length === 0
  ) {
    return {
      action: "clear",
    };
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
    action: "apply",
    contextKeys: builder.entries().map(([key]) => key),
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
