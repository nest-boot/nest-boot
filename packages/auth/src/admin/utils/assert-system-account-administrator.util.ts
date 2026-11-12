import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { DEFAULT_USER_ADMIN_ROLES } from "../../core/constants/user.constants.js";
import { Session } from "../../core/entities/session.entity.js";
import { User } from "../../core/entities/user.entity.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import { assertUserSession } from "../../core/utils/assert-current-identity.util.js";

/**
 * Requires an administrator's human session for platform credential management.
 * @param options - Authentication role configuration.
 * @returns Administrator recorded for audit.
 */
export function assertSystemAccountAdministrator(
  options: AuthModuleOptions,
): User {
  if (options.admin?.enabled !== true) {
    throw new ForbiddenException("Administration is disabled");
  }
  const user = RequestContext.isActive() ? RequestContext.get(User) : null;
  if (
    !user?.roles.some((role) =>
      (options.user?.adminRoles ?? DEFAULT_USER_ADMIN_ROLES).includes(role),
    )
  ) {
    throw new ForbiddenException("A user administrator session is required");
  }
  assertUserSession(user);
  const session = RequestContext.get(Session);
  if (session?.user.id !== user.id) {
    throw new ForbiddenException("A user administrator session is required");
  }
  return user;
}
