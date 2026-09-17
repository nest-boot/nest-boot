/* eslint-disable @typescript-eslint/unbound-method */
import { LockMode, UniqueConstraintViolationException } from "@mikro-orm/core";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { mockRlsContext } from "../../test/mock-rls-context.js";
import {
  createTestInvitation,
  createTestMember,
  createTestUser,
  createTestWorkspace,
  createWorkspaceServices,
} from "../../test/workspace-service.fixture.js";
import { InvitationConnection } from "../connections/invitation.connection-definition.js";
import { Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";

describe("InvitationService", () => {
  it("resolves the latest invitee identity only after locking the workspace", async () => {
    const { invitationService, em } = createWorkspaceServices();
    let locked = false;
    em.refreshOrFail.mockImplementation((entity) => {
      locked = true;
      return Promise.resolve(entity);
    });
    em.findOne.mockImplementation((entity) => {
      if (entity === User)
        return Promise.resolve(
          locked ? Object.assign(new User(), { id: "new-member" }) : null,
        );
      if (entity === Member) return Promise.resolve(createTestMember());
      return Promise.resolve(null);
    });
    await expect(
      invitationService.createInvitation(
        createTestWorkspace(),
        createTestUser(),
        {
          email: "new@example.com",
          roles: ["member"],
        },
      ),
    ).rejects.toThrow("User is already a member");
    expect(em.persist).not.toHaveBeenCalled();
  });
  it.each([
    "assertCurrentWorkspace",
    "assertCurrentUser",
    "assertWorkspaceCan",
  ] as const)(
    "authorizes the isolated login lookup with %s before reading users",
    async (assertion) => {
      const { invitationService, em, accessControlService } =
        createWorkspaceServices();
      vi.mocked(accessControlService[assertion]).mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(
        invitationService.getUserIdForInvitation(
          createTestWorkspace(),
          createTestUser(),
          "private@example.com",
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(em.findOne).not.toHaveBeenCalled();
    },
  );

  it("denies invitation relations when both recipient and workspace access are missing", async () => {
    const { invitationService, em, accessControlService } =
      createWorkspaceServices();
    const user = Object.assign(createTestUser(), {
      email: "recipient@example.com",
    });
    const invitation = Object.assign(createTestInvitation(), {
      email: user.email,
    });
    vi.mocked(accessControlService.userCan).mockReturnValue(false);
    vi.mocked(accessControlService.assertCurrentWorkspace).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(User, user);
      await expect(
        invitationService.getInvitationWorkspace(invitation),
      ).rejects.toThrow(ForbiddenException);
    });
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it.each(["getInvitationInviter", "getInvitationWorkspace"] as const)(
    "%s rejects related rows hidden by RLS",
    async (method) => {
      const { invitationService, em } = createWorkspaceServices();
      const invitation = Object.assign(createTestInvitation(), {
        email: "invitee@example.com",
        inviter: { id: "inviter" },
      });
      em.findOne.mockResolvedValueOnce(invitation).mockResolvedValueOnce(null);
      await expect(invitationService[method](invitation)).rejects.toThrow(
        "not found",
      );
      expect(em.findOne).toHaveBeenCalledTimes(2);
    },
  );

  it("resolves invitation relations for recipients with global user-read permission without requiring workspace membership", async () => {
    const { invitationService, em, accessControlService } =
      createWorkspaceServices();
    const session = mockRlsContext(em);
    const recipient = Object.assign(createTestUser(), {
      email: "Invitee@example.com",
    });
    const inviter = Object.assign(createTestUser(), { id: "inviter" });
    const workspace = createTestWorkspace();
    const invitation = Object.assign(createTestInvitation(), {
      email: "invitee@example.com",
      inviter: { id: inviter.id, loadOrFail: vi.fn() },
    });
    em.findOne
      .mockResolvedValueOnce(invitation)
      .mockResolvedValueOnce(inviter)
      .mockResolvedValueOnce(invitation)
      .mockResolvedValueOnce(workspace);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(User, recipient);
      await expect(
        invitationService.getInvitationInviter(invitation),
      ).resolves.toBe(inviter);
      await expect(
        invitationService.getInvitationWorkspace(invitation),
      ).resolves.toBe(workspace);
    });
    expect(accessControlService.userCan).toHaveBeenCalledWith(
      "read",
      invitation,
    );
    expect(accessControlService.assertCurrentWorkspace).not.toHaveBeenCalled();
    expect(accessControlService.assertWorkspaceCan).not.toHaveBeenCalled();
    expect(em.findOne).toHaveBeenCalledWith(
      Workspace,
      { id: workspace.id, deletedAt: null },
      { refresh: true },
    );
    expect(invitation.inviter.loadOrFail).not.toHaveBeenCalled();
    expect(em.fork).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(session);
  });

  it("does not expose a private inviter merely because an invitation is readable", async () => {
    const { invitationService, em, accessControlService } =
      createWorkspaceServices();
    const recipient = Object.assign(createTestUser(), {
      id: "recipient",
      email: "invitee@example.com",
    });
    const invitation = Object.assign(createTestInvitation(), {
      email: recipient.email,
      inviter: { id: "private-inviter" },
    });
    em.findOne.mockResolvedValue(invitation);
    vi.mocked(accessControlService.assertUserCan).mockImplementation(
      (_action, subject) => {
        if (subject === User) throw new ForbiddenException();
      },
    );
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(User, recipient);
      await expect(
        invitationService.getInvitationInviter(invitation),
      ).rejects.toThrow(ForbiddenException);
    });
    expect(em.findOne).toHaveBeenCalledTimes(1);
    expect(em.findOne).toHaveBeenCalledWith(
      Invitation,
      { id: invitation.id },
      { refresh: true },
    );
  });

  it("requires workspace authorization for invitation relations of non-recipients", async () => {
    const { invitationService, em, accessControlService } =
      createWorkspaceServices();
    const invitation = Object.assign(createTestInvitation(), {
      email: "other@example.com",
    });
    const workspace = createTestWorkspace();
    em.findOne
      .mockResolvedValueOnce(invitation)
      .mockResolvedValueOnce(workspace);
    await expect(
      invitationService.getInvitationWorkspace(invitation),
    ).resolves.toBe(workspace);
    expect(accessControlService.assertCurrentWorkspace).toHaveBeenCalledWith(
      invitation.workspace,
    );
    expect(accessControlService.assertWorkspaceCan).toHaveBeenCalledWith(
      "read",
      invitation,
    );
    vi.mocked(accessControlService.assertCurrentWorkspace).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );
    em.findOne.mockClear();
    await expect(
      invitationService.getInvitationInviter(invitation),
    ).rejects.toThrow(ForbiddenException);
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it("does not resolve cached invitation relations when the parent is hidden by RLS", async () => {
    const { invitationService, em } = createWorkspaceServices();
    const invitation = Object.assign(createTestInvitation(), {
      email: "invitee@example.com",
    });
    em.findOne.mockResolvedValue(null);
    await expect(
      invitationService.getInvitationInviter(invitation),
    ).rejects.toThrow("Workspace invitation not found");
    expect(em.findOne).toHaveBeenCalledTimes(1);
    expect(em.findOne).toHaveBeenCalledWith(
      Invitation,
      { id: invitation.id },
      { refresh: true },
    );
  });

  it("reads one invitation with the request manager without bypassing RLS or filters", async () => {
    const { invitationService, em, accessControlService } =
      createWorkspaceServices();
    const session = mockRlsContext(em);
    const invitation = Object.assign(createTestInvitation(), {
      email: "recipient@example.com",
    });
    em.findOne.mockResolvedValueOnce(invitation).mockResolvedValueOnce(null);
    await expect(invitationService.getInvitation(invitation.id)).resolves.toBe(
      invitation,
    );
    await expect(invitationService.getInvitation("hidden")).resolves.toBeNull();
    expect(em.findOne).toHaveBeenCalledWith(
      Invitation,
      { id: invitation.id },
      { refresh: true },
    );
    expect(accessControlService.userCan).toHaveBeenCalledWith(
      "read",
      Invitation,
    );
    expect(em.fork).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(session);
    vi.mocked(accessControlService.userCan).mockReturnValue(false);
    vi.mocked(accessControlService.workspaceCan).mockReturnValue(false);
    await expect(
      invitationService.getInvitation(invitation.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.findOne).toHaveBeenCalledTimes(2);
  });

  it("checks user invitation permissions in the service before querying", async () => {
    const { invitationService, accessControlService, em } =
      createWorkspaceServices();
    const user = createTestUser();
    const invitation = createTestInvitation();
    vi.mocked(accessControlService.assertUserCan).mockImplementation(() => {
      throw new ForbiddenException();
    });
    for (const operation of [
      () => invitationService.getInvitationByUser("id", user),
      () =>
        invitationService.getInvitationConnectionByUser(user, { first: 20 }),
      () => invitationService.acceptInvitation(user, "id"),
      () => invitationService.rejectInvitation(user, invitation),
    ])
      await expect(operation()).rejects.toBeInstanceOf(ForbiddenException);
    expect(accessControlService.assertUserCan).toHaveBeenCalledWith(
      "read",
      Invitation,
    );
    expect(accessControlService.assertUserCan).toHaveBeenCalledWith(
      "update",
      Invitation,
    );
    expect(em.find).not.toHaveBeenCalled();
    expect(em.findOne).not.toHaveBeenCalled();
    expect(em.nativeUpdate).not.toHaveBeenCalled();
  });

  it("locks workspace before invitation and rechecks a concurrent cancellation", async () => {
    const { invitationService, em } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = Object.assign(createTestUser(), {
      email: "alice@example.com",
    });
    const invitation = Object.assign(createTestInvitation(), {
      email: user.email,
      workspace,
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000),
    });
    em.findOne.mockResolvedValueOnce(invitation);
    em.refreshOrFail.mockImplementation((entity) => {
      if (entity === invitation) invitation.status = "canceled";
      return Promise.resolve(entity);
    });
    await expect(
      invitationService.acceptInvitation(user, invitation.id),
    ).rejects.toThrow("Workspace invitation is not pending");
    expect(em.refreshOrFail).toHaveBeenNthCalledWith(
      1,
      workspace,
      expect.objectContaining({ lockMode: LockMode.PESSIMISTIC_WRITE }),
    );
    expect(em.refreshOrFail).toHaveBeenNthCalledWith(
      2,
      invitation,
      expect.objectContaining({ lockMode: LockMode.PESSIMISTIC_WRITE }),
    );
    expect(em.create).not.toHaveBeenCalled();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the configured default role for invitations", async () => {
    const { em, invitationService } = createWorkspaceServices({
      creatorRole: "founder",
      defaultRole: "viewer",
      permissions: [],
      roles: { founder: [], viewer: [] },
    });
    const workspace = createTestWorkspace();
    const inviter = Object.assign(createTestUser(), {
      email: "owner@example.com",
      name: "Owner",
    });
    em.findOne.mockResolvedValue(null);

    const invitation = await invitationService.createInvitation(
      workspace,
      inviter,
      {
        email: "alice@example.com",
      },
    );

    expect(invitation.roles).toEqual(["viewer"]);
    expect(em.create).toHaveBeenCalledWith(
      Invitation,
      expect.objectContaining({ roles: ["viewer"] }),
    );
  });

  it("creates and accepts an email-bound invitation", async () => {
    const { em, invitationService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const inviter = Object.assign(createTestUser(), {
      email: "owner@example.com",
      name: "Owner",
    });
    const user = Object.assign(createTestUser(), {
      email: "alice@example.com",
      name: "Alice",
    });
    em.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const invitation = await invitationService.createInvitation(
      workspace,
      inviter,
      {
        email: "alice@example.com",
        roles: ["member"],
      },
    );
    expect(invitation.status).toBe("pending");
    expect(invitation.inviter).toBe(inviter);
    expect(invitation.expiresAt).toBeInstanceOf(Date);

    em.findOne.mockResolvedValueOnce(invitation).mockResolvedValueOnce(null);
    await expect(
      invitationService.acceptInvitation(user, invitation.id),
    ).resolves.toEqual({
      invitation,
      member: expect.objectContaining({
        roles: ["member"],
        status: "ACTIVE",
        user,
      }),
    });
    expect(invitation.status).toBe("accepted");
  });

  it.each(["different@example.com", null])(
    "checks login identity when the member contact email is %s",
    async (contactEmail) => {
      const { em, invitationService } = createWorkspaceServices();
      const workspace = createTestWorkspace();
      const inviter = Object.assign(createTestUser(), {
        email: "owner@example.com",
      });
      const user = Object.assign(createTestUser(), {
        email: "alice@example.com",
      });
      const member = Object.assign(createTestMember(), {
        user,
        workspace,
        email: contactEmail,
      });
      em.findOne.mockImplementation((entity, where) => {
        if (entity === User) return Promise.resolve(user);
        if (entity === Member && "user" in where && where.user === user.id) {
          return Promise.resolve(member);
        }
        return Promise.resolve(null);
      });

      await expect(
        invitationService.createInvitation(workspace, inviter, {
          email: " ALICE@example.com ",
        }),
      ).rejects.toThrow("User is already a member");
      expect(em.findOne).toHaveBeenNthCalledWith(
        1,
        User,
        { email: user.email },
        { fields: ["id"], filters: false },
      );
      expect(em.findOne).toHaveBeenCalledWith(
        Member,
        {
          workspace,
          user: user.id,
        },
        { filters: false },
      );
      expect(em.create).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "allows an invited email used only as another member's contact address (registered: %s)",
    async (registered) => {
      const { em, invitationService } = createWorkspaceServices();
      const workspace = createTestWorkspace();
      const inviter = createTestUser();
      const email = "invitee@example.com";
      const user = Object.assign(createTestUser(), { email });
      const unrelatedMember = Object.assign(createTestMember(), {
        email,
        workspace,
        user: createTestUser(),
      });
      em.findOne.mockImplementation((entity, where) => {
        if (entity === User) return Promise.resolve(registered ? user : null);
        if (entity === Member && "email" in where && where.email === email) {
          return Promise.resolve(unrelatedMember);
        }
        return Promise.resolve(null);
      });

      await expect(
        invitationService.createInvitation(workspace, inviter, { email }),
      ).resolves.toMatchObject({ email, status: "pending" });
      expect(em.findOne).toHaveBeenCalledWith(
        User,
        { email },
        { fields: ["id"], filters: false },
      );
      expect(em.create).toHaveBeenCalledTimes(1);
      expect(em.create).toHaveBeenCalledWith(
        Invitation,
        expect.objectContaining({ email }),
      );
      if (registered) {
        expect(em.findOne).toHaveBeenCalledWith(
          Member,
          { workspace, user: user.id },
          { filters: false },
        );
      } else {
        expect(
          em.findOne.mock.calls.some(([entity]) => entity === Member),
        ).toBe(false);
      }
    },
  );

  it("rejects duplicate active invitations and unauthenticated email senders", async () => {
    const workspace = createTestWorkspace();
    const inviter = Object.assign(createTestUser(), {
      email: "owner@example.com",
    });
    const activeInvitation = Object.assign(createTestInvitation(), {
      email: "alice@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      status: "pending" as const,
      workspace,
    });
    const duplicate = createWorkspaceServices();
    duplicate.em.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(activeInvitation);

    await expect(
      duplicate.invitationService.createInvitation(workspace, inviter, {
        email: activeInvitation.email,
      }),
    ).rejects.toThrow("User is already invited to this workspace");

    const missingSender = createWorkspaceServices({
      sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
    });
    missingSender.em.findOne.mockResolvedValue(null);
    await expect(
      missingSender.invitationService.createInvitation(workspace, inviter, {
        email: "bob@example.com",
      }),
    ).rejects.toThrow("Invitation sender is not an active workspace member");
  });

  it("maps invitation uniqueness races to a conflict response", async () => {
    const { em, invitationService } = createWorkspaceServices();
    em.transactional.mockRejectedValue(
      new UniqueConstraintViolationException(new Error("duplicate")),
    );

    await expect(
      invitationService.createInvitation(
        createTestWorkspace(),
        createTestUser(),
        {
          email: "alice@example.com",
        },
      ),
    ).rejects.toThrow("User is already invited to this workspace");
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    "rejects invalid invitation lifetime %s at the service boundary",
    async (expiresIn) => {
      const { em, invitationService } = createWorkspaceServices();

      await expect(
        invitationService.createInvitation(
          createTestWorkspace(),
          createTestUser(),
          {
            email: "alice@example.com",
            expiresIn,
          },
        ),
      ).rejects.toThrow(
        "Workspace invitation lifetime must be a positive integer",
      );
      expect(em.findOne).not.toHaveBeenCalled();
      expect(em.persist).not.toHaveBeenCalled();
    },
  );

  it("sends the configured invitation email after persisting the invitation", async () => {
    const sendInvitationEmail = vi.fn().mockResolvedValue(undefined);
    const { em, invitationService } = createWorkspaceServices({
      sendInvitationEmail,
    });
    const workspace = createTestWorkspace();
    const inviter = Object.assign(createTestUser(), {
      email: "owner@example.com",
      name: "Owner",
    });
    const inviterMember = Object.assign(createTestMember(), {
      roles: ["owner"],
      user: inviter,
      workspace,
    });
    const request = new Request("https://app.example.com/invitations");
    em.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(inviterMember);

    const invitation = await invitationService.createInvitation(
      workspace,
      inviter,
      {
        email: " INVITED@example.com ",
        roles: ["admin"],
      },
      request,
    );

    expect(sendInvitationEmail).toHaveBeenCalledWith(
      {
        email: "invited@example.com",
        id: invitation.id,
        invitation,
        inviter: expect.objectContaining({
          id: inviterMember.id,
          roles: ["owner"],
          user: inviter,
        }),
        roles: ["admin"],
        workspace,
      },
      request,
    );
    expect(em.flush.mock.invocationCallOrder[0]).toBeLessThan(
      sendInvitationEmail.mock.invocationCallOrder[0],
    );
  });

  it("cancels a pending invitation when email delivery fails", async () => {
    const deliveryError = new Error("SMTP unavailable");
    const sendInvitationEmail = vi.fn().mockRejectedValue(deliveryError);
    const { em, invitationService } = createWorkspaceServices({
      sendInvitationEmail,
    });
    const workspace = createTestWorkspace();
    const inviter = Object.assign(createTestUser(), {
      email: "owner@example.com",
      name: "Owner",
    });
    const inviterMember = Object.assign(createTestMember(), {
      roles: ["owner"],
      user: inviter,
      workspace,
    });
    em.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(inviterMember);

    await expect(
      invitationService.createInvitation(workspace, inviter, {
        email: "invited@example.com",
      }),
    ).rejects.toBe(deliveryError);

    const invitation = em.create.mock.results.at(-1)?.value as Invitation;
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      Invitation,
      { id: invitation.id, status: "pending" },
      { status: "canceled" },
    );
  });

  it("gets and lists workspace and current-user invitations", async () => {
    const { em, invitationService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = Object.assign(createTestUser(), {
      email: "ALICE@example.com",
    });
    const invitation = Object.assign(createTestInvitation(), {
      email: "alice@example.com",
    });
    em.findOne.mockResolvedValue(invitation);
    const connection = { edges: [{ node: invitation }], pageInfo: {} };
    const find = vi
      .spyOn(ConnectionManager.prototype, "find")
      .mockResolvedValue(connection as never);
    const args = { first: 20, after: "cursor" };

    await expect(
      invitationService.getInvitationByUser(invitation.id, user),
    ).resolves.toBe(invitation);
    await expect(
      invitationService.getInvitationByWorkspace(invitation.id, workspace),
    ).resolves.toBe(invitation);
    await expect(
      invitationService.getInvitationConnectionByWorkspace(workspace, args),
    ).resolves.toBe(connection);
    await expect(
      invitationService.getInvitationConnectionByUser(user, args),
    ).resolves.toBe(connection);

    expect(em.findOne).toHaveBeenCalledWith(Invitation, {
      email: "alice@example.com",
      id: invitation.id,
    });
    expect(em.findOne).toHaveBeenCalledWith(Invitation, {
      id: invitation.id,
      workspace,
    });
    expect(find).toHaveBeenNthCalledWith(1, InvitationConnection, args, {
      where: { workspace },
    });
    expect(find).toHaveBeenNthCalledWith(2, InvitationConnection, args, {
      where: {
        email: "alice@example.com",
        expiresAt: { $gt: expect.any(Date) },
        status: "pending",
        workspace: { deletedAt: null },
      },
    });
    find.mockRestore();
  });

  it("ignores expired pending invitations when creating a replacement", async () => {
    const { em, invitationService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const inviter = Object.assign(createTestUser(), {
      email: "owner@example.com",
      name: "Owner",
    });
    const expired = Object.assign(createTestInvitation(), {
      email: "alice@example.com",
      expiresAt: new Date(Date.now() - 60_000),
      status: "pending" as const,
      workspace,
    });
    em.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(expired);

    await expect(
      invitationService.createInvitation(workspace, inviter, {
        email: "alice@example.com",
      }),
    ).resolves.toBeInstanceOf(Invitation);
    expect(em.findOne).toHaveBeenNthCalledWith(
      2,
      Invitation,
      {
        email: "alice@example.com",
        status: "pending",
        workspace,
      },
      { filters: false },
    );
    expect(expired.status).toBe("canceled");
    expect(em.flush).toHaveBeenCalledTimes(2);
  });

  it("cancels a pending invitation while retaining its lifecycle record", async () => {
    const { em, invitationService } = createWorkspaceServices();
    const invitation = Object.assign(createTestInvitation(), {
      status: "pending" as const,
    });

    await expect(invitationService.cancelInvitation(invitation)).resolves.toBe(
      invitation,
    );

    expect(invitation.status).toBe("canceled");
    expect(em.remove).not.toHaveBeenCalled();
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      Invitation,
      expect.objectContaining({
        id: invitation.id,
        status: "pending",
      }),
      { status: "canceled" },
    );
  });

  it("rejects a concurrent invitation cancellation", async () => {
    const { em, invitationService } = createWorkspaceServices();
    const invitation = Object.assign(createTestInvitation(), {
      status: "pending" as const,
    });
    em.nativeUpdate.mockResolvedValueOnce(0);

    await expect(
      invitationService.cancelInvitation(invitation),
    ).rejects.toThrow("Workspace invitation is not pending");
    expect(invitation.status).toBe("pending");
  });

  it("keeps rejected invitations as separate audit records", async () => {
    const { em, invitationService } = createWorkspaceServices();
    const user = Object.assign(createTestUser(), {
      email: "ALICE@example.com",
    });
    const invitation = Object.assign(createTestInvitation(), {
      email: "alice@example.com",
      status: "pending" as const,
    });

    await expect(
      invitationService.rejectInvitation(user, invitation),
    ).resolves.toBe(invitation);
    expect(invitation.status).toBe("rejected");
    expect(em.remove).not.toHaveBeenCalled();
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      Invitation,
      {
        email: "alice@example.com",
        id: invitation.id,
        status: "pending",
      },
      { status: "rejected" },
    );
  });

  it("rejects a concurrent invitation rejection", async () => {
    const { em, invitationService } = createWorkspaceServices();
    const user = Object.assign(createTestUser(), {
      email: "alice@example.com",
    });
    const invitation = Object.assign(createTestInvitation(), {
      email: user.email,
      status: "pending" as const,
    });
    em.nativeUpdate.mockResolvedValueOnce(0);

    await expect(
      invitationService.rejectInvitation(user, invitation),
    ).rejects.toThrow("Workspace invitation is not pending");
    expect(invitation.status).toBe("pending");
  });

  it("does not accept expired or already completed invitations", async () => {
    const { em, invitationService } = createWorkspaceServices();
    const user = Object.assign(createTestUser(), {
      email: "alice@example.com",
    });
    const expired = Object.assign(createTestInvitation(), {
      email: user.email,
      expiresAt: new Date(Date.now() - 1),
      status: "pending" as const,
    });
    em.findOne.mockResolvedValueOnce(expired);

    await expect(
      invitationService.acceptInvitation(user, expired.id),
    ).rejects.toThrow("Workspace invitation has expired");
    expect(expired.status).toBe("pending");
    expect(em.persist).not.toHaveBeenCalled();

    const accepted = Object.assign(createTestInvitation(), {
      email: user.email,
      expiresAt: new Date(Date.now() + 60_000),
      status: "accepted" as const,
    });
    em.findOne.mockResolvedValueOnce(accepted);

    await expect(
      invitationService.acceptInvitation(user, accepted.id),
    ).rejects.toThrow("Workspace invitation is not pending");
    expect(em.persist).not.toHaveBeenCalled();
  });

  it("does not accept invitations for a deleted workspace", async () => {
    const { em, invitationService } = createWorkspaceServices();
    const user = Object.assign(createTestUser(), {
      email: "alice@example.com",
    });
    const workspace = Object.assign(createTestWorkspace(), {
      deletedAt: new Date(),
    });
    const invitation = Object.assign(createTestInvitation(), {
      email: user.email,
      expiresAt: new Date(Date.now() + 60_000),
      status: "pending" as const,
      workspace,
    });
    em.findOne.mockResolvedValueOnce(invitation);

    await expect(
      invitationService.acceptInvitation(user, invitation.id),
    ).rejects.toThrow("Workspace has been deleted");
    expect(em.persist).not.toHaveBeenCalled();
  });

  it("rejects missing, mismatched, and already-member invitation acceptance", async () => {
    const { em, invitationService } = createWorkspaceServices();
    const user = Object.assign(createTestUser(), {
      email: "alice@example.com",
    });

    em.findOne.mockResolvedValueOnce(null);
    await expect(
      invitationService.acceptInvitation(user, "missing"),
    ).resolves.toBeNull();

    const invitation = Object.assign(createTestInvitation(), {
      email: "other@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      status: "pending" as const,
      workspace: createTestWorkspace(),
    });
    em.findOne.mockResolvedValueOnce(invitation);
    await expect(
      invitationService.acceptInvitation(user, invitation.id),
    ).rejects.toThrow("Workspace invitation belongs to another email address");

    invitation.email = user.email;
    em.findOne
      .mockResolvedValueOnce(invitation)
      .mockResolvedValueOnce(createTestMember());
    await expect(
      invitationService.acceptInvitation(user, invitation.id),
    ).rejects.toThrow("User is already a member");
  });
});
