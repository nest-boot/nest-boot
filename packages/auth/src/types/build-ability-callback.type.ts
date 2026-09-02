import type { ExecutionContext } from "@nestjs/common";

import type { PermissionAbility } from "./permission-ability.type.js";

/** Callback used to build the permission ability for the current execution context. */
export type BuildAbilityCallback = (
  ctx: ExecutionContext,
) => PermissionAbility | null | Promise<PermissionAbility | null>;
