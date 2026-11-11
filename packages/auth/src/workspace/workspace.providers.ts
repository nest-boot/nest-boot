import type { Provider } from "@nestjs/common";

import { featureProvider } from "../common/feature-provider.js";
import { InvitationResolver } from "./resolvers/invitation.resolver.js";
import { MemberResolver } from "./resolvers/member.resolver.js";
import { UserWorkspaceResolver } from "./resolvers/user-workspace.resolver.js";
import { WorkspaceResolver } from "./resolvers/workspace.resolver.js";
import { InvitationService } from "./services/invitation.service.js";
import { MemberService } from "./services/member.service.js";
import { WorkspaceService } from "./services/workspace.service.js";
/** Workspace identity APIs remain independent of optional credential APIs. */
export const workspaceProviders: Provider[] = [
  featureProvider(
    WorkspaceResolver,
    "workspace",
    [WorkspaceService, MemberService, InvitationService],
    (
      _options,
      workspaces: WorkspaceService,
      members: MemberService,
      invitations: InvitationService,
    ) => new WorkspaceResolver(workspaces, members, invitations),
  ),
  featureProvider(
    MemberResolver,
    "workspace",
    [MemberService],
    (_options, members: MemberService) => new MemberResolver(members),
  ),
  featureProvider(
    InvitationResolver,
    "workspace",
    [InvitationService],
    (_options, invitations: InvitationService) =>
      new InvitationResolver(invitations),
  ),
  featureProvider(
    UserWorkspaceResolver,
    "workspace",
    [WorkspaceService, InvitationService],
    (_options, workspaces: WorkspaceService, invitations: InvitationService) =>
      new UserWorkspaceResolver(workspaces, invitations),
  ),
];
