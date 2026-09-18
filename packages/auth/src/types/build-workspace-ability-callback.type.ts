import type { Workspace } from "../entities/workspace.entity.js";
import type { AbilityRules } from "../interfaces/ability-rules.interface.js";

/** Synchronously extends business abilities and restricts built-in abilities. */
export type BuildWorkspaceAbilityCallback<Permission extends string = string> =
  (
    /** Permission-bound business grants and additional restrictions. */
    rules: AbilityRules<Permission>,
    /** Deduplicated permissions resolved from the membership's roles and direct grants. */
    permissions: readonly Permission[],
    /** Workspace selected for the current request. */
    workspace: Workspace,
  ) => void;
