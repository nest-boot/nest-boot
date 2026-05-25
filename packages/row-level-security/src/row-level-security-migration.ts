import { Migration } from "@mikro-orm/migrations";

import type { PolicySqlOptions } from "./interfaces/policy-sql-options.interface";
import { createPolicyBootstrapSqlStatements } from "./utils/create-policy-bootstrap-sql-statements";
import { createPolicyDownSql } from "./utils/create-policy-down-sql";
import { createPolicyUpSqlStatements } from "./utils/create-policy-up-sql-statements";

export abstract class RowLevelSecurityMigration extends Migration {
  protected addRowLevelSecurityBootstrapSql() {
    for (const sql of createPolicyBootstrapSqlStatements()) {
      this.addSql(sql);
    }
  }

  protected addPolicySql(options: PolicySqlOptions) {
    for (const sql of createPolicyUpSqlStatements(options)) {
      this.addSql(sql);
    }
  }

  protected addDropPolicySql(options: PolicySqlOptions) {
    this.addSql(createPolicyDownSql(options));
  }
}
