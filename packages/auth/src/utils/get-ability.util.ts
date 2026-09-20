import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import type { AuthAbility } from "../abilities/auth.ability.js";
import { AccessControlService } from "../services/access-control.service.js";

/** Reads the unified ability prepared for the current request. */
export function getAbility(): AuthAbility {
  const ability = RequestContext.isActive()
    ? RequestContext.get(AccessControlService)?.getAbility()
    : null;

  if (!ability) {
    throw new ForbiddenException("Permission ability is not available");
  }

  return ability;
}
