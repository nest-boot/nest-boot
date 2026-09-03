import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { USER_PERMISSION_ABILITY } from "../permission.constants.js";
import type { PermissionAbility } from "../types/permission-ability.type.js";

/** Reads the user ability prepared for the current request. */
export function getUserAbility(): PermissionAbility {
  const ability =
    RequestContext.get<PermissionAbility>(USER_PERMISSION_ABILITY) ?? null;

  if (!ability) {
    throw new ForbiddenException("User permission ability is not available");
  }

  return ability;
}
