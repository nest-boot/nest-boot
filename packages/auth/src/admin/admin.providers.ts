import { EntityManager } from "@mikro-orm/core";
import type { Provider } from "@nestjs/common";

import { featureProvider } from "../common/feature-provider.js";
import { AuthService } from "../core/services/auth.service.js";
import { SessionService } from "../core/services/session.service.js";
import { UserService } from "../core/services/user.service.js";
import { AdminSessionResolver } from "./resolvers/admin-session.resolver.js";
import { AdminUserResolver } from "./resolvers/admin-user.resolver.js";
import { SystemAccountResolver } from "./resolvers/system-account.resolver.js";
import { SystemAccountService } from "./services/system-account.service.js";

/** Administration is absent unless explicitly enabled. */
export const adminProviders: Provider[] = [
  featureProvider(
    SystemAccountService,
    "admin",
    [EntityManager],
    (options, em: EntityManager) => new SystemAccountService(em, options),
  ),
  featureProvider(
    SystemAccountResolver,
    "admin",
    [SystemAccountService],
    (_options, accounts: SystemAccountService) =>
      new SystemAccountResolver(accounts),
  ),
  featureProvider(
    AdminUserResolver,
    "admin",
    [UserService],
    (_options, users: UserService) => new AdminUserResolver(users),
  ),
  featureProvider(
    AdminSessionResolver,
    "admin",
    [SessionService, AuthService],
    (_options, sessions: SessionService, auth: AuthService) =>
      new AdminSessionResolver(sessions, auth),
  ),
];
