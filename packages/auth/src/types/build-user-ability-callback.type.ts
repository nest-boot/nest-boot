import type { AbilityBuilder } from "@casl/ability";

import type { UserAbility } from "../abilities/user.ability.js";
import type { BaseUser } from "../entities/user.entity.js";

/** Builds the current user's CASL ability from resolved permissions. */
export type BuildUserAbilityCallback<
  Permission extends string = string,
  User extends BaseUser = BaseUser,
> = (
  /** Ability builder configured to create a UserAbility. */
  builder: AbilityBuilder<UserAbility>,
  /** Deduplicated permissions resolved from the user's roles and direct grants. */
  permissions: readonly Permission[],
  /** User authenticated for the current request. */
  user: User,
) => UserAbility;
