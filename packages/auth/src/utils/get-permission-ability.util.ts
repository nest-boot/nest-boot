import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { PERMISSION_ABILITY } from "../permission.constants.js";
import type { PermissionAbility } from "../types/permission-ability.type.js";

/** Reads the permission ability prepared for the current request. */
export const getPermissionAbility = (): PermissionAbility => {
  const ability =
    RequestContext.get<PermissionAbility>(PERMISSION_ABILITY) ?? null;

  if (!ability) {
    throw new ForbiddenException("Permission ability is not available");
  }

  return ability;
};
