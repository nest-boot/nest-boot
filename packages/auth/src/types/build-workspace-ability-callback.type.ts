import type { AbilityBuilder } from "@casl/ability";

import type { WorkspaceAbility } from "../abilities/workspace.ability.js";
import type { BaseWorkspace } from "../entities/workspace.entity.js";

/** Builds the current workspace's CASL ability from resolved member permissions. */
export type BuildWorkspaceAbilityCallback<
  Permission extends string = string,
  Workspace extends BaseWorkspace = BaseWorkspace,
> = (
  /** Ability builder configured to create a WorkspaceAbility. */
  builder: AbilityBuilder<WorkspaceAbility>,
  /** Deduplicated permissions resolved from the membership's roles and direct grants. */
  permissions: readonly Permission[],
  /** Workspace selected for the current request. */
  workspace: Workspace,
) => WorkspaceAbility;
