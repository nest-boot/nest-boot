import { PolicyCommand } from "../enums/policy-command.enum";
import { PolicyMode } from "../enums/policy-mode.enum";

export interface PolicyOptions {
  name?: string;
  mode?: PolicyMode;
  command?: PolicyCommand;
  property?: string;
  context?: string;
  using?: string;
  withCheck?: string;
  roles?: string[];
}
