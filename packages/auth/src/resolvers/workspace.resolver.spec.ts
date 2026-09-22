import { ForbiddenException } from "@nestjs/common";
import type { Mocked } from "vitest";

import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { type InvitationService } from "../features/invitations/invitation.service.js";
import { type MemberService } from "../services/member.service.js";
import { type WorkspaceService } from "../services/workspace.service.js";
import { WorkspaceResolver } from "./workspace.resolver.js";

describe("WorkspaceResolver", () => {
  it("passes the parent workspace and pagination to the service and propagates denial", async () => {
    const workspace = { id: "parent-workspace" } as Workspace;
    const args = { first: 10, after: "cursor" };
    const connection = { edges: [], pageInfo: {} };
    const getInvitationConnectionByWorkspace = vi
      .fn()
      .mockResolvedValueOnce(connection)
      .mockRejectedValueOnce(new ForbiddenException());
    const { resolver } = createResolver(
      {},
      {},
      { getInvitationConnectionByWorkspace },
    );
    await expect(resolver.invitations(workspace, args)).resolves.toBe(
      connection,
    );
    expect(getInvitationConnectionByWorkspace).toHaveBeenCalledWith(
      workspace,
      args,
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

  it("delegates leaving a workspace to MemberService", async () => {
    const member = { id: "member_1", name: "Leaving member" } as Member;
    const { resolver, memberService } = createResolver(
      {},
      {
        leaveWorkspace: vi.fn(async () => member),
      },
    );

    await expect(resolver.leaveWorkspace(member)).resolves.toEqual({
      memberId: member.id,
    });
    expect(memberService.leaveWorkspace).toHaveBeenCalledWith(member);
    const denied = new ForbiddenException();
    memberService.leaveWorkspace.mockRejectedValueOnce(denied);
    await expect(resolver.leaveWorkspace(member)).rejects.toBe(denied);
  });
});

function createResolver(
  overrides: Partial<WorkspaceService> = {},
  memberOverrides: Partial<MemberService> = {},
  invitationOverrides: Partial<InvitationService> = {},
) {
  const workspaceService = { ...overrides } as Mocked<WorkspaceService>;
  const memberService = {
    ...memberOverrides,
  } as Mocked<MemberService>;
  const invitationService = {
    ...invitationOverrides,
  } as Mocked<InvitationService>;
  return {
    resolver: new WorkspaceResolver(
      workspaceService,
      {} as never,
      memberService,
      invitationService,
    ),
    workspaceService,
    memberService,
    invitationService,
  };
}
