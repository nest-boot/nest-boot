import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import {
  PERMISSION_ABILITY,
  USER_PERMISSION_ABILITY,
} from "../permission.constants.js";
import type { PermissionAbility } from "../types/permission-ability.type.js";

/** Reads the permission ability prepared for the current request. */
export const getPermissionAbility = (
  scope: "user" | "workspace" = "workspace",
): PermissionAbility => {
  const key = scope === "user" ? USER_PERMISSION_ABILITY : PERMISSION_ABILITY;
  const ability = RequestContext.get<PermissionAbility>(key) ?? null;

  if (!ability) {
    throw new ForbiddenException("Permission ability is not available");
  }

  return ability;
};
