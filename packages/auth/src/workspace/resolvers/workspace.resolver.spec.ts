import { ForbiddenException } from "@nestjs/common";
import type { GraphQLResolveInfo } from "graphql";
import { type Mocked } from "vitest";

import { User } from "../../core/entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceMember } from "../entities/workspace-member.entity.js";
import { type WorkspaceService } from "../services/workspace.service.js";
import { type WorkspaceInvitationService } from "../services/workspace-invitation.service.js";
import { type WorkspaceMemberService } from "../services/workspace-member.service.js";
import { WorkspaceResolver } from "./workspace.resolver.js";

describe("WorkspaceResolver", () => {
  it("forwards pagination selection to authorized member and invitation queries", async () => {
    const workspace = new Workspace();
    const args = { first: 10, after: "cursor" };
    const info = {
      fieldNodes: [],
      fragments: {},
      variableValues: {},
    } as unknown as GraphQLResolveInfo;
    const result = { edges: [], pageInfo: {} };
    const getWorkspaceMemberConnectionByWorkspace = vi
      .fn()
      .mockResolvedValue(result);
    const getWorkspaceInvitationConnectionByWorkspace = vi
      .fn()
      .mockResolvedValue(result);
    const { resolver } = createResolver(
      {},
      { getWorkspaceMemberConnectionByWorkspace },
      { getWorkspaceInvitationConnectionByWorkspace },
    );
    await expect(resolver.members(workspace, args, info)).resolves.toBe(result);
    await expect(resolver.invitations(workspace, args, info)).resolves.toBe(
      result,
    );
    expect(
      getWorkspaceMemberConnectionByWorkspace,
    ).toHaveBeenCalledExactlyOnceWith(workspace, args, info);
    expect(
      getWorkspaceInvitationConnectionByWorkspace,
    ).toHaveBeenCalledExactlyOnceWith(workspace, args, info);
    getWorkspaceMemberConnectionByWorkspace.mockRejectedValueOnce(
      new ForbiddenException(),
    );
    await expect(
      resolver.members(workspace, args, info),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("passes the parent workspace and pagination to the service and propagates denial", async () => {
    const workspace = { id: "parent-workspace" } as Workspace;
    const args = { first: 10, after: "cursor" };
    const connection = { edges: [], pageInfo: {} };
    const getWorkspaceInvitationConnectionByWorkspace = vi
      .fn()
      .mockResolvedValueOnce(connection)
      .mockRejectedValueOnce(new ForbiddenException());
    const { resolver } = createResolver(
      {},
      {},
      { getWorkspaceInvitationConnectionByWorkspace },
    );
    await expect(resolver.invitations(workspace, args)).resolves.toBe(
      connection,
    );
    expect(getWorkspaceInvitationConnectionByWorkspace).toHaveBeenCalledWith(
      workspace,
      args,
      undefined,
    );
    await expect(resolver.invitations(workspace, args)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it("delegates current workspace access and failures to the service", () => {
    const workspace = { id: "workspace_1" } as Workspace;
    const getCurrentWorkspace = vi
      .fn()
      .mockReturnValueOnce(workspace)
      .mockReturnValueOnce(null)
      .mockImplementationOnce(() => {
        throw new ForbiddenException();
      });
    const { resolver } = createResolver({ getCurrentWorkspace });
    expect(resolver.currentWorkspace()).toBe(workspace);
    expect(resolver.currentWorkspace()).toBeNull();
    expect(() => resolver.currentWorkspace()).toThrow(ForbiddenException);
  });
  it("forwards workspace lookup arguments and nullable service results", async () => {
    const workspace = { id: "workspace_1" } as Workspace;
    const user = { id: "user_1" } as User;
    const { resolver, workspaceService } = createResolver({
      getUserWorkspace: vi.fn(async () => workspace),
    });
    await expect(resolver.workspace(workspace.id, user)).resolves.toBe(
      workspace,
    );
    expect(workspaceService.getUserWorkspace).toHaveBeenCalledWith(
      workspace.id,
      user,
    );
    workspaceService.getUserWorkspace.mockResolvedValueOnce(null);
    await expect(resolver.workspace(workspace.id, user)).resolves.toBeNull();
  });
  it("delegates workspace lifecycle operations to WorkspaceService", async () => {
    const workspace = { id: "workspace_1", name: "Acme" } as Workspace;
    const user = { id: "user_1" } as User;
    const { resolver, workspaceService } = createResolver({
      createWorkspace: vi.fn(async () => workspace),
      updateWorkspace: vi.fn(async () => workspace),
      deleteWorkspace: vi.fn(async () => workspace),
    });
    await expect(
      resolver.createWorkspace(user, { name: "Acme" }),
    ).resolves.toEqual({ id: workspace.id });
    await expect(
      resolver.updateWorkspace(workspace.id, { name: "New" }),
    ).resolves.toEqual({ id: workspace.id });
    await expect(resolver.deleteWorkspace(workspace.id)).resolves.toEqual({
      id: workspace.id,
    });
    expect(workspaceService.createWorkspace).toHaveBeenCalledWith(user, {
      name: "Acme",
    });
    expect(workspaceService.updateWorkspace).toHaveBeenCalledWith(
      workspace.id,
      {
        name: "New",
      },
    );
    expect(workspaceService.deleteWorkspace).toHaveBeenCalledWith(workspace.id);
  });
  it("delegates leaving a workspace to WorkspaceMemberService", async () => {
    const member = {
      id: "member_1",
      name: "Leaving member",
    } as WorkspaceMember;
    const { resolver, workspaceMemberService } = createResolver(
      {},
      {
        leaveWorkspace: vi.fn(async () => member),
      },
    );
    await expect(resolver.leaveWorkspace(member)).resolves.toEqual({
      memberId: member.id,
    });
    expect(workspaceMemberService.leaveWorkspace).toHaveBeenCalledWith(member);
    const denied = new ForbiddenException();
    workspaceMemberService.leaveWorkspace.mockRejectedValueOnce(denied);
    await expect(resolver.leaveWorkspace(member)).rejects.toBe(denied);
  });
});

/**
 * Returns test resolver and its mocked dependencies.
 * @param overrides - Fixture values that replace the defaults.
 * @param memberOverrides - WorkspaceMember service methods replaced for this test.
 * @param invitationOverrides - WorkspaceInvitation service methods replaced for this test.
 * @returns Test resolver and its mocked dependencies.
 */
function createResolver(
  overrides: Partial<WorkspaceService> = {},
  memberOverrides: Partial<WorkspaceMemberService> = {},
  invitationOverrides: Partial<WorkspaceInvitationService> = {},
) {
  const workspaceService = { ...overrides } as Mocked<WorkspaceService>;
  const workspaceMemberService = {
    ...memberOverrides,
  } as Mocked<WorkspaceMemberService>;
  const workspaceInvitationService = {
    ...invitationOverrides,
  } as Mocked<WorkspaceInvitationService>;
  return {
    resolver: new WorkspaceResolver(
      workspaceService,
      workspaceMemberService,
      workspaceInvitationService,
    ),
    workspaceService,
    workspaceMemberService,
    workspaceInvitationService,
  };
}
