import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { UserAbility } from "../abilities/user.ability.js";

/** Reads the user ability prepared for the current request. */
export function getUserAbility(): UserAbility {
  const ability = RequestContext.get(UserAbility) ?? null;

  if (!ability) {
    throw new ForbiddenException("User permission ability is not available");
  }

  return ability;
}
