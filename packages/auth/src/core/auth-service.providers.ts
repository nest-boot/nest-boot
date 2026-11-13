import { EntityManager } from "@mikro-orm/core";

import { ApiKeyAuthenticationService } from "../api-key/services/api-key-authentication.service.js";
import { featureProvider } from "../common/feature-provider.js";
import { WorkspaceService } from "../workspace/services/workspace.service.js";
import { WorkspaceInvitationService } from "../workspace/services/workspace-invitation.service.js";
import { WorkspaceMemberService } from "../workspace/services/workspace-member.service.js";
import { AuthContext } from "./auth-context.js";
import { SessionService } from "./services/session.service.js";
import { UserService } from "./services/user.service.js";
/** Standard providers; factories are limited to optional feature registration. */
export const authServiceProviders = [
  UserService,
  SessionService,
  featureProvider(
    WorkspaceService,
    "workspace",
    [EntityManager, AuthContext],
    (options, em: EntityManager, context: AuthContext) =>
      new WorkspaceService(em, options, context),
  ),
  featureProvider(
    WorkspaceMemberService,
    "workspace",
    [EntityManager, AuthContext],
    (options, em: EntityManager, context: AuthContext) =>
      new WorkspaceMemberService(em, options, context),
  ),
  featureProvider(
    WorkspaceInvitationService,
    "workspace",
    [EntityManager],
    (options, em: EntityManager) => new WorkspaceInvitationService(em, options),
  ),
  featureProvider(
    ApiKeyAuthenticationService,
    "apiKey",
    [EntityManager],
    (options, em: EntityManager) =>
      new ApiKeyAuthenticationService(em, options),
  ),
];
