import type { AbilityBuilder } from "@casl/ability";

import type { AuthAbility } from "../../common/auth.ability.js";
import type { AbilityContext } from "../../common/interfaces/ability-context.interface.js";

/** Native CASL builder and effective request identity supplied to buildAbility. */
export interface BuildAbilityContext<
  UserPermission extends string = string,
  WorkspacePermission extends string = string,
> extends AbilityContext<UserPermission, WorkspacePermission> {
  /** Native builder used to configure the single request ability. */
  readonly builder: AbilityBuilder<AuthAbility>;
}
