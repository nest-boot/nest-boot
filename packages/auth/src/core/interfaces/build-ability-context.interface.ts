import type { AbilityContext } from "../../common/interfaces/ability-context.interface.js";
import type { AbilityRules } from "../../common/interfaces/ability-rules.interface.js";

/** Native CASL builder and effective request identity supplied to buildAbility. */
export interface BuildAbilityContext<
  UserPermission extends string = string,
  WorkspacePermission extends string = string,
> extends AbilityContext<UserPermission, WorkspacePermission> {
  /** Native builder used to configure the single request ability. */
  readonly builder: AbilityRules;
}
