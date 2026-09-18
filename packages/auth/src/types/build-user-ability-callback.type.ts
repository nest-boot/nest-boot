import type { User } from "../entities/user.entity.js";
import type { AbilityRules } from "../interfaces/ability-rules.interface.js";

/** Synchronously extends business abilities and restricts built-in abilities. */
export type BuildUserAbilityCallback<Permission extends string = string> = (
  /** Permission-bound business grants and additional restrictions. */
  rules: AbilityRules<Permission>,
  /** Deduplicated permissions resolved from the user's roles and direct grants. */
  permissions: readonly Permission[],
  /** User authenticated for the current request. */
  user: User,
) => void;
