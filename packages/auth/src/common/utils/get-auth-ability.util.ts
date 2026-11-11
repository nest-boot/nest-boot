import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { getCurrentApiKey } from "../../api-key/utils/get-current-api-key.util.js";
import { User } from "../../core/entities/user.entity.js";
import { AuthAbility } from "../auth.ability.js";

/**
 * Returns the current request's prepared ability or throws ForbiddenException.
 * Retrieve the instance again after identity changes; do not cache it across requests.
 * @returns Ability stored in the current request context.
 */
export function getAuthAbility(): AuthAbility {
  if (
    !RequestContext.isActive() ||
    (!RequestContext.get(User) && !getCurrentApiKey())
  ) {
    throw new ForbiddenException("Permission ability is not available");
  }
  const ability = RequestContext.get(AuthAbility);
  if (!ability) {
    throw new ForbiddenException("Permission ability is not available");
  }
  return ability;
}
