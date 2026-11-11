import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
import { DEFAULT_USER_ADMIN_ROLES } from "../user.constants.js";

/**
 * Requires an administrator's human session for platform credential management.
 * @param options - Authentication role configuration.
 * @returns Administrator recorded for audit.
 */
export function assertSystemAccountAdministrator(
  options: AuthModuleOptions,
): User {
  const user = RequestContext.isActive() ? RequestContext.get(User) : null;
  if (
    !user?.roles.some((role) =>
      (options.user?.adminRoles ?? DEFAULT_USER_ADMIN_ROLES).includes(role),
    )
  ) {
    throw new ForbiddenException("A user administrator session is required");
  }
  RequestIdentity.assertUserSession(user);
  const session = RequestContext.get(Session);
  if (session?.user.id !== user.id) {
    throw new ForbiddenException("A user administrator session is required");
  }
  return user;
}
