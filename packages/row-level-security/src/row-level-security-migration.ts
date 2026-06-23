import { Migration } from "@mikro-orm/migrations";

import type { PolicySqlOptions } from "./interfaces/policy-sql-options.interface.js";
import { createPolicyBootstrapSqlStatements } from "./utils/create-policy-bootstrap-sql-statements.js";
import { createPolicyRoleUpSqlStatements } from "./utils/create-policy-role-sql-statements.js";
import { createPolicyUpSqlStatements } from "./utils/create-policy-up-sql-statements.js";

/** Base MikroORM migration with convenience helpers for row-level security SQL. */
export abstract class RowLevelSecurityMigration extends Migration {
  /** Adds shared RLS bootstrap SQL. Currently no-op; roles are managed outside migrations. */
  protected addRowLevelSecurityBootstrapSql(roles: string[] = []) {
    for (const sql of createPolicyBootstrapSqlStatements()) {
      this.addSql(sql);
    }

    for (const sql of createPolicyRoleUpSqlStatements(roles)) {
      this.addSql(sql);
    }
  }

  /** Adds SQL that enables RLS and creates the configured policy. */
  protected addPolicySql(options: PolicySqlOptions) {
    for (const sql of createPolicyRoleUpSqlStatements(options.roles)) {
      this.addSql(sql);
    }

    for (const sql of createPolicyUpSqlStatements(options)) {
      this.addSql(sql);
    }
  }
}
