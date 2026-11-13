import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { type Mocked } from "vitest";

import { User as BaseUser, User } from "../../core/entities/user.entity.js";
import {
  Workspace as BaseWorkspace,
  Workspace,
} from "../entities/workspace.entity.js";
import {
  WorkspaceInvitation as BaseWorkspaceInvitation,
  WorkspaceInvitation,
} from "../entities/workspace-invitation.entity.js";
import { WorkspaceMember } from "../entities/workspace-member.entity.js";
import { type WorkspaceInvitationService } from "../services/workspace-invitation.service.js";
import { WorkspaceInvitationResolver } from "./workspace-invitation.resolver.js";

describe("WorkspaceInvitationResolver", () => {
  it("delegates invitation lookup by ID without injecting the current user", async () => {
    const invitation = { id: "invitation_1" } as WorkspaceInvitation;
    const { resolver, workspaceInvitationService } = createResolver({
      getWorkspaceInvitation: vi.fn().mockResolvedValue(invitation),
    });
    await expect(resolver.workspaceInvitation(invitation.id)).resolves.toBe(
      invitation,
    );
    expect(
      workspaceInvitationService.getWorkspaceInvitation,
    ).toHaveBeenCalledWith(invitation.id);
  });
  it("creates a separate invitation through WorkspaceInvitationService", async () => {
    const invitation = { id: "invitation_1" } as WorkspaceInvitation;
    const workspace = { id: "workspace_1" } as Workspace;
    const user = { id: "user_1" } as User;
    const input = {
      email: "invited@example.com",
      roles: ["member"],
    };
    const { resolver, workspaceInvitationService } = createResolver({
      createWorkspaceInvitation: vi.fn(async () => invitation),
    });
    await expect(
      resolver.createWorkspaceInvitation(workspace, user, input),
    ).resolves.toEqual({ id: invitation.id });
    expect(
      workspaceInvitationService.createWorkspaceInvitation,
    ).toHaveBeenCalledWith(workspace, user, input);
  });
  it("propagates invitation creation errors from WorkspaceInvitationService", async () => {
    const denied = new ForbiddenException();
    const workspace = { id: "workspace_1" } as Workspace;
    const user = { id: "user_1" } as User;
    const input = { email: "invited@example.com", roles: ["member"] };
    const { resolver, workspaceInvitationService } = createResolver({
      createWorkspaceInvitation: vi.fn().mockRejectedValue(denied),
    });
    await expect(
      resolver.createWorkspaceInvitation(workspace, user, input),
    ).rejects.toBe(denied);
    expect(
      workspaceInvitationService.createWorkspaceInvitation,
    ).toHaveBeenCalledWith(workspace, user, input);
  });
  it("forwards nullable invitation results and service errors", async () => {
    const denied = new ForbiddenException();
    const getWorkspaceInvitation = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(denied);
    const { resolver } = createResolver({ getWorkspaceInvitation });
    await expect(resolver.workspaceInvitation("hidden")).resolves.toBeNull();
    await expect(resolver.workspaceInvitation("denied")).rejects.toBe(denied);
  });
  it("returns only accepted invitation identifiers", async () => {
    const invitation = {
      id: "invitation_1",
      workspace: { id: "workspace_1" },
    } as WorkspaceInvitation;
    const member = { id: "member_1" } as WorkspaceMember;
    const user = { id: "user_1" } as User;
    const { resolver, workspaceInvitationService } = createResolver({
      acceptWorkspaceInvitation: vi.fn(async () => ({ invitation, member })),
    });
    await expect(
      resolver.acceptWorkspaceInvitation(invitation.id, user),
    ).resolves.toEqual({
      id: invitation.id,
      memberId: member.id,
      workspaceId: "workspace_1",
    });
    expect(
      workspaceInvitationService.acceptWorkspaceInvitation,
    ).toHaveBeenCalledWith(user, invitation.id);
  });
  it("reports missing invitations when accepting", async () => {
    const { resolver } = createResolver({
      acceptWorkspaceInvitation: vi.fn(async () => null),
    });
    await expect(
      resolver.acceptWorkspaceInvitation("missing", {} as User),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it("forwards the current user and invitation ID when rejecting", async () => {
    const user = { id: "user_1" } as User;
    const invitation = { id: "invitation_1" } as WorkspaceInvitation;
    const rejectedWorkspaceInvitation = {
      ...invitation,
      status: "rejected",
    } as WorkspaceInvitation;
    const { resolver, workspaceInvitationService } = createResolver({
      rejectWorkspaceInvitation: vi.fn(async () => rejectedWorkspaceInvitation),
    });
    await expect(
      resolver.rejectWorkspaceInvitation(invitation.id, user),
    ).resolves.toEqual({ id: invitation.id });
    expect(
      workspaceInvitationService.rejectWorkspaceInvitation,
    ).toHaveBeenCalledWith(user, invitation.id);
  });
  it("reports missing invitations when rejecting", async () => {
    const { resolver, workspaceInvitationService } = createResolver({
      rejectWorkspaceInvitation: vi
        .fn()
        .mockRejectedValue(new NotFoundException()),
    });
    await expect(
      resolver.rejectWorkspaceInvitation("missing", {} as User),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      workspaceInvitationService.rejectWorkspaceInvitation,
    ).toHaveBeenCalledWith(expect.anything(), "missing");
  });
  it("propagates cancellation errors from WorkspaceInvitationService", async () => {
    const missing = new NotFoundException();
    const { resolver, workspaceInvitationService } = createResolver({
      cancelWorkspaceInvitation: vi.fn().mockRejectedValue(missing),
    });
    await expect(
      resolver.cancelWorkspaceInvitation("invitation_1"),
    ).rejects.toBe(missing);
    expect(
      workspaceInvitationService.cancelWorkspaceInvitation,
    ).toHaveBeenCalledWith("invitation_1");
  });
});

/**
 * Returns test resolver and its mocked dependencies.
 * @param overrides - Fixture values that replace the defaults.
 * @returns Test resolver and its mocked dependencies.
 */
function createResolver(overrides: Record<string, unknown> = {}) {
  const workspaceInvitationService = {
    acceptWorkspaceInvitation: vi.fn(),
    cancelWorkspaceInvitation: vi.fn(),
    createWorkspaceInvitation: vi.fn(),
    getWorkspaceInvitation: vi.fn(),
    rejectWorkspaceInvitation: vi.fn(),
    ...overrides,
  } as unknown as Mocked<WorkspaceInvitationService>;
  return {
    resolver: new WorkspaceInvitationResolver(workspaceInvitationService),
    workspaceInvitationService,
  };
}

describe("relation fields", () => {
  describe("workspace relation fields", () => {
    it("delegates invitation relations and propagates authorization failures", async () => {
      const invitation = new BaseWorkspaceInvitation();
      const user = new BaseUser();
      const workspace = new BaseWorkspace();
      const service = {
        getWorkspaceInvitationInviter: vi.fn().mockResolvedValue(user),
        getWorkspaceInvitationWorkspace: vi.fn().mockResolvedValue(workspace),
      };
      const resolver = new WorkspaceInvitationResolver(
        service as unknown as WorkspaceInvitationService,
      );
      await expect(resolver.inviter(invitation)).resolves.toBe(user);
      await expect(resolver.workspace(invitation)).resolves.toBe(workspace);
      expect(service.getWorkspaceInvitationInviter).toHaveBeenCalledWith(
        invitation,
      );
      expect(service.getWorkspaceInvitationWorkspace).toHaveBeenCalledWith(
        invitation,
      );
      service.getWorkspaceInvitationInviter.mockRejectedValueOnce(
        new Error("denied"),
      );
      await expect(resolver.inviter(invitation)).rejects.toThrow("denied");
    });
  });
});
