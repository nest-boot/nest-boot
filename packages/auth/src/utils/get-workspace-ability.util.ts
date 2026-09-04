import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { WorkspaceAbility } from "../abilities/workspace.ability.js";

/** Reads the workspace ability prepared for the current request. */
export function getWorkspaceAbility(): WorkspaceAbility {
  const ability = RequestContext.get(WorkspaceAbility) ?? null;

  if (!ability) {
    throw new ForbiddenException(
      "Workspace permission ability is not available",
    );
  }

  return ability;
}
