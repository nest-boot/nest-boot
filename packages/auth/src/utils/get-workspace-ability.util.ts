import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import type { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { AccessControlService } from "../services/access-control.service.js";

/** Reads the workspace ability prepared for the current request. */
export function getWorkspaceAbility(): WorkspaceAbility {
  const ability = RequestContext.isActive()
    ? RequestContext.get(AccessControlService)?.getWorkspaceAbility()
    : null;

  if (!ability) {
    throw new ForbiddenException(
      "Workspace permission ability is not available",
    );
  }

  return ability;
}
