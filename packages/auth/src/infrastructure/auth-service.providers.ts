import { EntityManager } from "@mikro-orm/core";
import { HashService } from "@nest-boot/hash";
import type { Provider } from "@nestjs/common";

import { AUTH_TOKEN } from "../auth.constants.js";
import { MODULE_OPTIONS_TOKEN } from "../auth.module-definition.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { AccessControlService } from "../services/access-control.service.js";
import { InvitationService } from "../services/invitation.service.js";
import { MemberService } from "../services/member.service.js";
import { SessionService } from "../services/session.service.js";
import { UserService } from "../services/user.service.js";
import { UserDeletionService } from "../services/user-deletion.service.js";
import { WorkspaceService } from "../services/workspace.service.js";
import { ApiKeyAuthenticationService } from "./api-key-authentication.service.js";
import { createContextualAuthService } from "./create-contextual-auth-service.js";

/** Explicit internal execution boundaries; ordinary management is deliberately absent. @internal */
export const authServiceProviders: Provider[] = [
  {
    provide: WorkspaceService,
    inject: [EntityManager, MODULE_OPTIONS_TOKEN, AccessControlService],
    useFactory: (
      em: EntityManager,
      options: AuthModuleOptions,
      access: AccessControlService,
    ) =>
      createContextualAuthService(
        em,
        (manager) => new WorkspaceService(manager, options, access),
        {
          createWorkspace: "authentication",
          deleteWorkspace: "workspace-delete",
        },
      ),
  },
  {
    provide: MemberService,
    inject: [EntityManager, MODULE_OPTIONS_TOKEN, AccessControlService],
    useFactory: (
      em: EntityManager,
      options: AuthModuleOptions,
      access: AccessControlService,
    ) =>
      createContextualAuthService(
        em,
        (manager) => new MemberService(manager, options, access),
        { getUserForMembership: "authentication" },
      ),
  },
  {
    provide: InvitationService,
    inject: [EntityManager, MODULE_OPTIONS_TOKEN, AccessControlService],
    useFactory: (
      em: EntityManager,
      options: AuthModuleOptions,
      access: AccessControlService,
    ) =>
      createContextualAuthService(
        em,
        (manager) => new InvitationService(manager, options, access),
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
      AccessControlService,
      UserDeletionService,
    ],
    useFactory: (
      em: EntityManager,
      options: AuthModuleOptions,
      hash: HashService,
      access: AccessControlService,
      deletion: UserDeletionService,
    ) =>
      createContextualAuthService(
        em,
        (manager) => new UserService(manager, options, hash, access, deletion),
        {
          createUser: "authentication",
          banUser: "authentication",
          unbanUser: "authentication",
          setUserPassword: "authentication",
          impersonateUser: "authentication",
          stopImpersonating: "authentication",
        },
      ),
  },
  {
    provide: ApiKeyAuthenticationService,
    inject: [EntityManager],
    useFactory: (em: EntityManager) =>
      createContextualAuthService(
        em,
        (manager) => new ApiKeyAuthenticationService(manager),
        {
          validate: "authentication",
        },
      ),
  },
  {
    provide: SessionService,
    inject: [AUTH_TOKEN, EntityManager, AccessControlService],
    useFactory: (
      auth: unknown,
      em: EntityManager,
      access: AccessControlService,
    ) =>
      createContextualAuthService(
        em,
        (manager) => new SessionService(auth, manager, access),
        {
          getCurrentAuthenticatedSession: "authentication",
          listCurrentUserSessions: "authentication",
          revokeSession: "authentication",
          revokeUserSessions: "authentication",
        },
      ),
  },
];
