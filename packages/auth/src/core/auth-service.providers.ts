import { EntityManager } from "@mikro-orm/core";
import { HashService } from "@nest-boot/hash";
import type { Provider } from "@nestjs/common";

import { ApiKeyAuthenticationService } from "../api-key/services/api-key-authentication.service.js";
import { InvitationService } from "../workspace/services/invitation.service.js";
import { MemberService } from "../workspace/services/member.service.js";
import { WorkspaceService } from "../workspace/services/workspace.service.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import { AUTH_TOKEN } from "./constants/auth.constants.js";
import { createContextualAuthService } from "./create-contextual-auth-service.js";
import type { AuthModuleOptions } from "./interfaces/auth-module-options.interface.js";
import { SessionService } from "./services/session.service.js";
import { UserService } from "./services/user.service.js";
import { UserDeletionService } from "./services/user-deletion.service.js";
import { resolveAuthFeatures } from "./utils/resolve-auth-features.util.js";

/**
 * Explicit internal execution boundaries; ordinary management is deliberately absent.
 * @internal
 */
export const authServiceProviders: Provider[] = [
  {
    provide: WorkspaceService,
    inject: [EntityManager, MODULE_OPTIONS_TOKEN],
    useFactory: (em: EntityManager, options: AuthModuleOptions) =>
      options.workspace?.enabled !== true
        ? null
        : createContextualAuthService(
            em,
            (manager) => new WorkspaceService(manager, options),
            {
              createWorkspace: "authentication",
            },
          ),
  },
  {
    provide: MemberService,
    inject: [EntityManager, MODULE_OPTIONS_TOKEN],
    useFactory: (em: EntityManager, options: AuthModuleOptions) =>
      options.workspace?.enabled !== true
        ? null
        : createContextualAuthService(
            em,
            (manager) => new MemberService(manager, options),
            { getUserForMembership: "authentication" },
          ),
  },
  {
    provide: InvitationService,
    inject: [EntityManager, MODULE_OPTIONS_TOKEN],
    useFactory: (em: EntityManager, options: AuthModuleOptions) =>
      options.workspace?.enabled !== true
        ? null
        : createContextualAuthService(
            em,
            (manager) => new InvitationService(manager, options),
            {
              getUserIdForInvitation: "invitation-identity",
              acceptInvitation: "authentication",
              rejectInvitation: "authentication",
            },
          ),
  },
  {
    provide: UserService,
    inject: [
      EntityManager,
      MODULE_OPTIONS_TOKEN,
      HashService,
      UserDeletionService,
    ],
    useFactory: (
      em: EntityManager,
      options: AuthModuleOptions,
      hash: HashService,
      deletion: UserDeletionService,
    ) =>
      createContextualAuthService(
        em,
        (manager) => new UserService(manager, options, hash, deletion),
        {
          createUser: "authentication",
          banUser: "authentication",
          setUserPassword: "authentication",
          impersonateUser: "authentication",
          stopImpersonating: "authentication",
        },
      ),
  },
  {
    provide: ApiKeyAuthenticationService,
    inject: [EntityManager, MODULE_OPTIONS_TOKEN],
    useFactory: (em: EntityManager, options: AuthModuleOptions) =>
      !resolveAuthFeatures(options).apiKey
        ? null
        : createContextualAuthService(
            em,
            (manager) => new ApiKeyAuthenticationService(manager, options),
            {
              validate: "authentication",
            },
          ),
  },
  {
    provide: SessionService,
    inject: [AUTH_TOKEN, EntityManager],
    useFactory: (auth: unknown, em: EntityManager) =>
      createContextualAuthService(
        em,
        (manager) => new SessionService(auth, manager),
        {
          getCurrentAuthenticatedSession: "authentication",
          listCurrentUserSessions: "authentication",
          revokeSession: "authentication",
          revokeUserSessions: "authentication",
        },
      ),
  },
];
