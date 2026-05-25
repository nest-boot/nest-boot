import { PolicyCommand } from "../enums/policy-command.enum";
import { PolicyMode } from "../enums/policy-mode.enum";

/** Low-level inputs used to generate PostgreSQL policy SQL. */
export interface PolicySqlOptions {
  /** Database schema containing the protected table. */
  schemaName: string;
  /** Table name on which row-level security is enabled. */
  tableName: string;
  /** PostgreSQL policy name. */
  policyName: string;
  /** PostgreSQL policy mode. Defaults to {@link PolicyMode.PERMISSIVE}. */
  mode?: PolicyMode;
  /** PostgreSQL command covered by the policy. Defaults to {@link PolicyCommand.ALL}. */
  command?: PolicyCommand;
  /** SQL expression emitted as the policy `USING` predicate. */
  using?: string;
  /** SQL expression emitted as the policy `WITH CHECK` predicate. */
  withCheck?: string;
  /** Database roles to which the generated policy applies. */
  roles?: string[];
}
