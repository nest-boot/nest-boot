import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { AuthAbility } from "../auth.ability.js";
import { User } from "../entities/user.entity.js";
import { getCurrentApiKey } from "./get-current-api-key.util.js";

/**
 * Returns the current request's prepared ability or throws ForbiddenException.
 * Retrieve the instance again after identity changes; do not cache it across requests.
 */
export function getAuthAbility(): AuthAbility {
  if (
    !RequestContext.isActive() ||
    (!RequestContext.get(User) && !getCurrentApiKey())
  )
    throw new ForbiddenException("Permission ability is not available");
  const ability = RequestContext.get(AuthAbility);
  if (!ability)
    throw new ForbiddenException("Permission ability is not available");
  return ability;
}
