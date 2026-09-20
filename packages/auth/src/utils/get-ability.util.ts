import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { AuthAbility } from "../abilities/auth.ability.js";
import { User } from "../entities/user.entity.js";
import { getCurrentApiKey } from "./get-current-api-key.util.js";

/** Reads the prepared ability only while its authenticated identity is available. @internal */
export function readRequestAbility(): AuthAbility | null {
  if (
    !RequestContext.isActive() ||
    (!RequestContext.get(User) && !getCurrentApiKey())
  )
    return null;
  return RequestContext.get(AuthAbility) ?? null;
}

/** Reads the current request ability, rejecting missing identity or authorization context. */
export function getAbility(): AuthAbility {
  const ability = readRequestAbility();
  if (!ability)
    throw new ForbiddenException("Permission ability is not available");
  return ability;
}
