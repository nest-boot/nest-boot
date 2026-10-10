import type { AbilityContext } from "../interfaces/ability-context.interface.js";
import type { AbilityRules } from "../interfaces/ability-rules.interface.js";

/** Synchronously extends one request ability with permission-bound business rules. */
export type BuildAbilityCallback<
  UserPermission extends string = string,
  WorkspacePermission extends string = string,
> = (
  rules: AbilityRules<UserPermission, WorkspacePermission>,
  context: AbilityContext<UserPermission, WorkspacePermission>,
) => void;
