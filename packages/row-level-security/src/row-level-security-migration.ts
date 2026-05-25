import { Migration } from "@mikro-orm/migrations";

import type { PolicySqlOptions } from "./interfaces/policy-sql-options.interface";
import { createPolicyBootstrapSqlStatements } from "./utils/create-policy-bootstrap-sql-statements";
import { createPolicyDownSql } from "./utils/create-policy-down-sql";
import { createPolicyUpSqlStatements } from "./utils/create-policy-up-sql-statements";

/** Base MikroORM migration with convenience helpers for row-level security SQL. */
export abstract class RowLevelSecurityMigration extends Migration {
  /** Adds the shared RLS roles, grants, schema, and `app.get_context` helper SQL. */
  protected addRowLevelSecurityBootstrapSql() {
    for (const sql of createPolicyBootstrapSqlStatements()) {
      this.addSql(sql);
    }
  }

  /** Adds SQL that enables RLS and creates the configured policy. */
  protected addPolicySql(options: PolicySqlOptions) {
    for (const sql of createPolicyUpSqlStatements(options)) {
      this.addSql(sql);
    }
  }

  /** Adds SQL that drops the configured policy and disables RLS when no policies remain. */
  protected addDropPolicySql(options: PolicySqlOptions) {
    this.addSql(createPolicyDownSql(options));
  }
}
