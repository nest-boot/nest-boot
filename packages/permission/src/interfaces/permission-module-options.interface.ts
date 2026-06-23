import type { BuildAbilityCallback } from "../types/build-ability-callback.type.js";

/** Permission module options. */
export interface PermissionModuleOptions {
  /** Builds a permission ability from the current execution context. */
  buildAbility: BuildAbilityCallback;
}
