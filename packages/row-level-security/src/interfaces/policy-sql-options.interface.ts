import { PolicyCommand } from "../enums/policy-command.enum";
import { PolicyMode } from "../enums/policy-mode.enum";

export interface PolicySqlOptions {
  schemaName: string;
  tableName: string;
  policyName: string;
  mode?: PolicyMode;
  command?: PolicyCommand;
  using?: string;
  withCheck?: string;
  roles?: string[];
}
