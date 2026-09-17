import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Mocked } from "vitest";

import { Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { type InvitationService } from "../services/invitation.service.js";
import { InvitationResolver } from "./invitation.resolver.js";

describe("InvitationResolver", () => {
  it("delegates invitation lookup by ID without injecting the current user", async () => {
    const invitation = { id: "invitation_1" } as Invitation;
    const { resolver, invitationService } = createResolver({
      getInvitation: vi.fn().mockResolvedValue(invitation),
    });
    await expect(resolver.invitation(invitation.id)).resolves.toBe(invitation);
    expect(invitationService.getInvitation).toHaveBeenCalledWith(invitation.id);
  });
  it("creates a separate invitation through InvitationService", async () => {
    const invitation = { id: "invitation_1" } as Invitation;
    const workspace = { id: "workspace_1" } as Workspace;
    const user = { id: "user_1" } as User;
    const input = {
      email: "invited@example.com",
      roles: ["member"],
    };
    const { resolver, invitationService } = createResolver({
      createInvitation: vi.fn(async () => invitation),
    });

    await expect(
      resolver.createInvitation(workspace, user, input),
    ).resolves.toEqual({ id: invitation.id });
    expect(invitationService.createInvitation).toHaveBeenCalledWith(
      workspace,
      user,
      input,
    );
  });

  it("propagates invitation creation errors from InvitationService", async () => {
    const denied = new ForbiddenException();
    const workspace = { id: "workspace_1" } as Workspace;
    const user = { id: "user_1" } as User;
    const input = { email: "invited@example.com", roles: ["member"] };
    const { resolver, invitationService } = createResolver({
      createInvitation: vi.fn().mockRejectedValue(denied),
    });

    await expect(
      resolver.createInvitation(workspace, user, input),
    ).rejects.toBe(denied);
    expect(invitationService.createInvitation).toHaveBeenCalledWith(
      workspace,
      user,
      input,
    );
  });

  it("forwards nullable invitation results and service errors", async () => {
    const denied = new ForbiddenException();
    const getInvitation = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(denied);
    const { resolver } = createResolver({ getInvitation });
    await expect(resolver.invitation("hidden")).resolves.toBeNull();
    await expect(resolver.invitation("denied")).rejects.toBe(denied);
  });

  it("returns only accepted invitation identifiers", async () => {
    const invitation = {
      id: "invitation_1",
      workspace: { id: "workspace_1" },
    } as Invitation;
    const member = { id: "member_1" } as Member;
    const user = { id: "user_1" } as User;
    const { resolver, invitationService } = createResolver({
      acceptInvitation: vi.fn(async () => ({ invitation, member })),
    });

    await expect(
      resolver.acceptInvitation(invitation.id, user),
    ).resolves.toEqual({
      id: invitation.id,
      memberId: member.id,
      workspaceId: "workspace_1",
    });
    expect(invitationService.acceptInvitation).toHaveBeenCalledWith(
      user,
      invitation.id,
    );
  });

  it("reports missing invitations when accepting", async () => {
    const { resolver } = createResolver({
      acceptInvitation: vi.fn(async () => null),
    });

    await expect(
      resolver.acceptInvitation("missing", {} as User),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("forwards the current user and invitation ID when rejecting", async () => {
    const user = { id: "user_1" } as User;
    const invitation = { id: "invitation_1" } as Invitation;
    const rejectedInvitation = {
      ...invitation,
      status: "rejected",
    } as Invitation;
    const { resolver, invitationService } = createResolver({
      rejectInvitation: vi.fn(async () => rejectedInvitation),
    });

    await expect(
      resolver.rejectInvitation(invitation.id, user),
    ).resolves.toEqual({ id: invitation.id });
    expect(invitationService.rejectInvitation).toHaveBeenCalledWith(
      user,
      invitation.id,
    );
  });

  it("reports missing invitations when rejecting", async () => {
    const { resolver, invitationService } = createResolver({
      rejectInvitation: vi.fn().mockRejectedValue(new NotFoundException()),
    });

    await expect(
      resolver.rejectInvitation("missing", {} as User),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(invitationService.rejectInvitation).toHaveBeenCalledWith(
      expect.anything(),
      "missing",
    );
  });

  it("propagates cancellation errors from InvitationService", async () => {
    const missing = new NotFoundException();
    const { resolver, invitationService } = createResolver({
      cancelInvitation: vi.fn().mockRejectedValue(missing),
    });

    await expect(resolver.cancelInvitation("invitation_1")).rejects.toBe(
      missing,
    );
    expect(invitationService.cancelInvitation).toHaveBeenCalledWith(
      "invitation_1",
    );
  });
});

function createResolver(overrides: Record<string, unknown> = {}) {
  const invitationService = {
    acceptInvitation: vi.fn(),
    cancelInvitation: vi.fn(),
    createInvitation: vi.fn(),
    getInvitation: vi.fn(),
    rejectInvitation: vi.fn(),
    ...overrides,
  } as unknown as Mocked<InvitationService>;

  return {
    resolver: new InvitationResolver(invitationService),
    invitationService,
  };
}
