import type { Provider } from "@nestjs/common";

import { featureProvider } from "../common/feature-provider.js";
import { UserWorkspaceResolver } from "./resolvers/user-workspace.resolver.js";
import { WorkspaceResolver } from "./resolvers/workspace.resolver.js";
import { WorkspaceInvitationResolver } from "./resolvers/workspace-invitation.resolver.js";
import { WorkspaceMemberResolver } from "./resolvers/workspace-member.resolver.js";
import { WorkspaceService } from "./services/workspace.service.js";
import { WorkspaceInvitationService } from "./services/workspace-invitation.service.js";
import { WorkspaceMemberService } from "./services/workspace-member.service.js";
/** Workspace identity APIs remain independent of optional credential APIs. */
export const workspaceProviders: Provider[] = [
  featureProvider(
    WorkspaceResolver,
    "workspace",
    [WorkspaceService, WorkspaceMemberService, WorkspaceInvitationService],
    (
      _options,
      workspaces: WorkspaceService,
      members: WorkspaceMemberService,
      invitations: WorkspaceInvitationService,
    ) => new WorkspaceResolver(workspaces, members, invitations),
  ),
  featureProvider(
    WorkspaceMemberResolver,
    "workspace",
    [WorkspaceMemberService],
    (_options, members: WorkspaceMemberService) =>
      new WorkspaceMemberResolver(members),
  ),
  featureProvider(
    WorkspaceInvitationResolver,
    "workspace",
    [WorkspaceInvitationService],
    (_options, invitations: WorkspaceInvitationService) =>
      new WorkspaceInvitationResolver(invitations),
  ),
  featureProvider(
    UserWorkspaceResolver,
    "workspace",
    [WorkspaceService, WorkspaceInvitationService],
    (
      _options,
      workspaces: WorkspaceService,
      invitations: WorkspaceInvitationService,
    ) => new UserWorkspaceResolver(workspaces, invitations),
  ),
];
