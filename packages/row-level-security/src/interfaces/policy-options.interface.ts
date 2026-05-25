import { PolicyCommand } from "../enums/policy-command.enum";
import { PolicyMode } from "../enums/policy-mode.enum";

/** Options accepted by the {@link Policy} decorator. */
export interface PolicyOptions {
  /** Explicit PostgreSQL policy name. If omitted, a stable name is generated from entity metadata. */
  name?: string;
  /** PostgreSQL policy mode. Defaults to {@link PolicyMode.PERMISSIVE}. */
  mode?: PolicyMode;
  /** PostgreSQL command covered by the policy. Defaults to {@link PolicyCommand.ALL}. */
  command?: PolicyCommand;
  /** Entity property used to generate the default policy predicate. */
  property?: string;
  /** Row-level security context key read through `app.get_context`. */
  context?: string;
  /** Explicit `USING` expression. Overrides the generated predicate when provided. */
  using?: string;
  /** Explicit `WITH CHECK` expression. Overrides the generated predicate when provided. */
  withCheck?: string;
  /** Database roles to which the policy applies. Empty or omitted means no role restriction. */
  roles?: string[];
}
