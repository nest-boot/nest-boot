import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { WORKSPACE_PERMISSION_ABILITY } from "../permission.constants.js";
import type { PermissionAbility } from "../types/permission-ability.type.js";

/** Reads the workspace ability prepared for the current request. */
export function getWorkspaceAbility(): PermissionAbility {
  const ability =
    RequestContext.get<PermissionAbility>(WORKSPACE_PERMISSION_ABILITY) ?? null;

  if (!ability) {
    throw new ForbiddenException(
      "Workspace permission ability is not available",
    );
  }

  return ability;
}
