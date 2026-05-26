import { Migration } from "@mikro-orm/migrations";

import type { PolicySqlOptions } from "./interfaces/policy-sql-options.interface";
import { createPolicyBootstrapSqlStatements } from "./utils/create-policy-bootstrap-sql-statements";
import { createPolicyDownSql } from "./utils/create-policy-down-sql";
import { createPolicyPrivilegeDownSqlStatements } from "./utils/create-policy-privilege-down-sql-statements";
import {
  createPolicyRoleDownSqlStatements,
  createPolicyRoleUpSqlStatements,
} from "./utils/create-policy-role-sql-statements";
import { createPolicyUpSqlStatements } from "./utils/create-policy-up-sql-statements";

/** Base MikroORM migration with convenience helpers for row-level security SQL. */
export abstract class RowLevelSecurityMigration extends Migration {
  /** Adds the shared RLS schema, helper function, roles, and role grants. */
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

  /** Adds SQL that drops the policy, revokes generated grants, and disables unused RLS. */
  protected addDropPolicySql(options: PolicySqlOptions) {
    this.addSql(createPolicyDownSql(options));

    for (const sql of createPolicyPrivilegeDownSqlStatements(options)) {
      this.addSql(sql);
    }

    for (const sql of createPolicyRoleDownSqlStatements(options.roles)) {
      this.addSql(sql);
    }
  }
}
