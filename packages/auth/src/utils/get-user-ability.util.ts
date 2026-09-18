import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import type { UserAbility } from "../abilities/user.ability.js";
import { AccessControlService } from "../services/access-control.service.js";

/** Reads the user ability prepared for the current request. */
export function getUserAbility(): UserAbility {
  const ability = RequestContext.isActive()
    ? RequestContext.get(AccessControlService)?.getUserAbility()
    : null;

  if (!ability) {
    throw new ForbiddenException("User permission ability is not available");
  }

  return ability;
}
