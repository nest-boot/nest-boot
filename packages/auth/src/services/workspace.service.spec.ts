/* eslint-disable @typescript-eslint/unbound-method */
import { LockMode } from "@mikro-orm/core";
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
import { MemberConnection } from "../connections/member.connection-definition.js";
import { WorkspaceConnection } from "../connections/workspace.connection-definition.js";
import { ApiKey as BaseApiKey } from "../entities/api-key.entity.js";
import { Invitation as InvitationEntity } from "../entities/invitation.entity.js";
import {
  Member as BaseMember,
  Member as MemberEntity,
} from "../entities/member.entity.js";
import { User as BaseUser } from "../entities/user.entity.js";
import {
  Workspace as BaseWorkspace,
  Workspace as WorkspaceEntity,
} from "../entities/workspace.entity.js";

describe("WorkspaceService and cross-domain coordination", () => {
  it("paginates authorized workspace memberships and members inside the service", async () => {
    const { workspaceService, memberService, em, accessControlService } =
      createWorkspaceServices();
    const user = createTestUser();
    const workspace = createTestWorkspace();
    const result = { edges: [], pageInfo: {} };
    const find = vi
      .spyOn(ConnectionManager.prototype, "find")
      .mockResolvedValue(result as never);
    const subquery = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      toRaw: vi.fn().mockReturnThis(),
    };
    Object.assign(em, { createQueryBuilder: vi.fn(() => subquery) });
    const args = { first: 10, after: "cursor" };
    try {
      await expect(
        workspaceService.getWorkspaceConnectionByUser(user, args),
      ).resolves.toBe(result);
      expect(subquery.where).toHaveBeenCalledWith({
        status: "ACTIVE",
        user: user.id,
      });
      expect(find).toHaveBeenLastCalledWith(WorkspaceConnection, args, {
        where: { id: { $in: subquery }, deletedAt: null },
      });
      await expect(
        memberService.getMemberConnectionByWorkspace(workspace, args),
      ).resolves.toBe(result);
      expect(find).toHaveBeenLastCalledWith(MemberConnection, args, {
        where: { workspace },
      });
      expect(find.mock.instances[0]).toHaveProperty("em", em);
      expect(accessControlService.assertCurrentWorkspace).toHaveBeenCalledWith(
        workspace,
      );
      expect(accessControlService.assertWorkspaceCan).toHaveBeenCalledWith(
        "read",
        MemberEntity,
      );
      find.mockClear();
      vi.mocked(accessControlService.assertCurrentUser).mockImplementation(
        () => {
          throw new ForbiddenException();
        },
      );
      vi.mocked(accessControlService.assertCurrentWorkspace).mockImplementation(
        () => {
          throw new ForbiddenException();
        },
      );
      await expect(
        workspaceService.getWorkspaceConnectionByUser(user, args),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        memberService.getMemberConnectionByWorkspace(workspace, args),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(find).not.toHaveBeenCalled();
    } finally {
      find.mockRestore();
    }
  });

  it("only returns a workspace to its active user member", async () => {
    const { workspaceService, em, accessControlService } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = createTestUser();
    em.findOne
      .mockResolvedValueOnce(workspace)
      .mockResolvedValueOnce(createTestMember());
    await expect(
      workspaceService.getUserWorkspace(workspace.id, user),
    ).resolves.toBe(workspace);
    expect(accessControlService.assertCurrentUser).toHaveBeenCalledWith(user);
    em.findOne.mockResolvedValueOnce(workspace).mockResolvedValueOnce(null);
    await expect(
      workspaceService.getUserWorkspace(workspace.id, user),
    ).resolves.toBeNull();
    em.findOne.mockResolvedValueOnce(null);
    await expect(
      workspaceService.getUserWorkspace("missing", user),
    ).resolves.toBeNull();
  });

  it("validates the current workspace and membership inside the service", async () => {
    const { workspaceService, memberService } = createWorkspaceServices();
    expect(workspaceService.getCurrentWorkspace()).toBeNull();
    expect(memberService.getCurrentMember()).toBeNull();
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      const workspace = createTestWorkspace();
      const user = createTestUser();
      RequestContext.set(BaseWorkspace, workspace);
      RequestContext.set(BaseUser, user);
      expect(() => workspaceService.getCurrentWorkspace()).toThrow(
        ForbiddenException,
      );
      RequestContext.set(BaseApiKey, new BaseApiKey());
      expect(() => memberService.getCurrentMember()).toThrow(
        ForbiddenException,
      );
      const member = createTestMember();
      RequestContext.set(BaseMember, member);
      expect(memberService.getCurrentMember()).toBe(member);
      expect(workspaceService.getCurrentWorkspace()).toBe(workspace);
    });
  });

  it.each(["member", "invitation", "delete"] as const)(
    "rechecks deleted workspace state under a row lock before %s",
    async (operation) => {
      const sendInvitationEmail = vi.fn();
      const { memberService, invitationService, workspaceService, em } =
        createWorkspaceServices({ sendInvitationEmail });
      const workspace = createTestWorkspace();
      const user = Object.assign(createTestUser(), {
        email: "alice@example.com",
      });
      em.refreshOrFail.mockImplementation((entity) =>
        Promise.resolve(Object.assign(entity, { deletedAt: new Date() })),
      );
      const operations = {
        member: () => memberService.addMember(workspace, user),
        invitation: () =>
          invitationService.createInvitation(workspace, user, {
            email: "invitee@example.com",
          }),
        delete: () => workspaceService.deleteWorkspace(workspace),
      };
      await expect(operations[operation]()).rejects.toThrow(
        "Workspace has been deleted",
      );
      expect(em.refreshOrFail).toHaveBeenCalledWith(
        workspace,
        expect.objectContaining({
          filters: false,
          lockMode: LockMode.PESSIMISTIC_WRITE,
        }),
      );
      expect(em.create).not.toHaveBeenCalled();
      expect(em.nativeUpdate).not.toHaveBeenCalled();
      expect(em.flush).not.toHaveBeenCalled();
      expect(sendInvitationEmail).not.toHaveBeenCalled();
    },
  );

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails before persistence when a service-level permission is denied", async () => {
    const { accessControlService, em, workspaceService } =
      createWorkspaceServices();
    vi.mocked(accessControlService.assertWorkspaceCan).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );

    await expect(
      workspaceService.updateWorkspace(createTestWorkspace(), {
        name: "Denied",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.assign).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it.each(["assertCurrentUser", "assertUserCan"] as const)(
    "checks %s before starting unrestricted workspace creation",
    async (check) => {
      const { accessControlService, em, workspaceService } =
        createWorkspaceServices();
      vi.mocked(accessControlService[check]).mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(
        workspaceService.createWorkspace(createTestUser(), { name: "Denied" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(em.fork).not.toHaveBeenCalled();
      expect(em.transactional).not.toHaveBeenCalled();
      expect(em.create).not.toHaveBeenCalled();
      expect(em.persist).not.toHaveBeenCalled();
    },
  );

  it("creates a workspace and its owner membership atomically", async () => {
    const { em, workspaceService } = createWorkspaceServices();
    const user = Object.assign(createTestUser(), {
      id: "user-1",
      email: "alice@example.com",
      name: "Alice",
    });

    const workspace = await workspaceService.createWorkspace(user, {
      name: "Acme",
    });

    expect(em.create).toHaveBeenNthCalledWith(1, WorkspaceEntity, {
      name: "Acme",
    });
    expect(em.create).toHaveBeenNthCalledWith(
      2,
      MemberEntity,
      expect.objectContaining({
        roles: ["owner"],
        status: "ACTIVE",
        user: user.id,
        workspace,
      }),
    );
    expect(em.persist).toHaveBeenCalledTimes(2);
    expect(em.flush).toHaveBeenCalledTimes(1);
    expect(em.transactional).toHaveBeenCalledTimes(1);
  });

  it("uses configured creator and default member roles", async () => {
    const { em, workspaceService, memberService } = createWorkspaceServices({
      creatorRole: "founder",
      defaultRole: "viewer",
      permissions: [],
      roles: { founder: [], viewer: [] },
    });
    const user = Object.assign(createTestUser(), {
      email: "alice@example.com",
      name: "Alice",
    });

    await workspaceService.createWorkspace(user, { name: "Acme" });
    em.findOne.mockResolvedValueOnce(null);
    await memberService.addMember(createTestWorkspace(), user);

    expect(em.create).toHaveBeenNthCalledWith(
      2,
      MemberEntity,
      expect.objectContaining({ roles: ["founder"] }),
    );
    expect(em.create).toHaveBeenNthCalledWith(
      3,
      MemberEntity,
      expect.objectContaining({ roles: ["viewer"] }),
    );
    expect(
      memberService.getEffectiveMemberPermissions(
        Object.assign(createTestMember(), { roles: undefined }),
      ),
    ).toEqual([]);
  });

  it("uses delete ability independently of the configured creator role", async () => {
    const { workspaceService, accessControlService } = createWorkspaceServices({
      creatorRole: "founder",
      defaultRole: "viewer",
      permissions: [],
      roles: { founder: [], viewer: [] },
    });
    const workspace = createTestWorkspace();
    await expect(workspaceService.deleteWorkspace(workspace)).resolves.toBe(
      workspace,
    );
    expect(accessControlService.assertWorkspaceCan).toHaveBeenLastCalledWith(
      "delete",
      workspace,
    );
  });

  it("updates mutable workspace fields", async () => {
    const { accessControlService, em, workspaceService } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();

    await expect(
      workspaceService.updateWorkspace(workspace, { name: "Renamed" }),
    ).resolves.toBe(workspace);

    expect(em.assign).toHaveBeenCalledWith(workspace, { name: "Renamed" });
    expect(em.flush).toHaveBeenCalledTimes(1);
    expect(accessControlService.assertCurrentWorkspace).toHaveBeenCalledWith(
      workspace,
    );
  });

  it("rejects workspace deletion without delete ability", async () => {
    const { em, workspaceService, accessControlService } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    vi.mocked(accessControlService.assertWorkspaceCan).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );

    await expect(
      workspaceService.deleteWorkspace(workspace),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("does not let a caller delete a different workspace", async () => {
    const { em, workspaceService, accessControlService } =
      createWorkspaceServices();
    vi.mocked(accessControlService.assertCurrentWorkspace).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );

    await expect(
      workspaceService.deleteWorkspace(createTestWorkspace()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("rechecks delete ability after locking and refreshing the workspace", async () => {
    const { em, workspaceService, accessControlService } =
      createWorkspaceServices();
    vi.mocked(accessControlService.assertWorkspaceCan)
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new ForbiddenException();
      });

    await expect(
      workspaceService.deleteWorkspace(createTestWorkspace()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.refreshOrFail).toHaveBeenCalledOnce();
    expect(em.nativeUpdate).not.toHaveBeenCalled();
  });

  it("preserves request RLS throughout workspace deletion", async () => {
    const { em, workspaceService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const sessionContext = mockRlsContext(em);
      await expect(workspaceService.deleteWorkspace(workspace)).resolves.toBe(
        workspace,
      );
      expect(em.getSessionContext()).toEqual(sessionContext);
      expect(em.fork).not.toHaveBeenCalled();
      expect(em.nativeUpdate).toHaveBeenCalledWith(
        WorkspaceEntity,
        { id: workspace.id, deletedAt: null },
        { deletedAt: expect.any(Date) },
      );
    });

    expect(workspace.deletedAt).toBeInstanceOf(Date);
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      InvitationEntity,
      { status: "pending", workspace },
      { status: "canceled" },
    );
  });

  it("finds workspaces and memberships through the public lookup APIs", async () => {
    const { em, workspaceService, memberService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = createTestUser();
    const member = Object.assign(createTestMember(), { workspace });
    em.findOne.mockResolvedValueOnce(workspace).mockResolvedValueOnce(member);
    em.find.mockResolvedValue([member]);

    await expect(workspaceService.findOne({ id: workspace.id })).resolves.toBe(
      workspace,
    );
    await expect(memberService.getMemberByUser(workspace, user)).resolves.toBe(
      member,
    );

    expect(em.findOne).toHaveBeenNthCalledWith(1, WorkspaceEntity, {
      id: workspace.id,
    });
    expect(em.findOne).toHaveBeenNthCalledWith(2, MemberEntity, {
      status: "ACTIVE",
      user,
      workspace,
    });
  });

  it("returns full workspace details split into members and invitations", async () => {
    const { em, workspaceService, accessControlService } =
      createWorkspaceServices();
    const session = mockRlsContext(em);
    const workspace = createTestWorkspace();
    const active = createTestMember();
    const disabled = Object.assign(createTestMember(), {
      status: "DISABLED" as const,
    });
    const invitation = createTestInvitation();
    em.find
      .mockResolvedValueOnce([active, disabled])
      .mockResolvedValueOnce([invitation]);

    await expect(workspaceService.getFullWorkspace(workspace)).resolves.toEqual(
      {
        invitations: [invitation],
        members: [active, disabled],
        workspace,
      },
    );
    expect(accessControlService.assertWorkspaceCan).toHaveBeenCalledWith(
      "read",
      MemberEntity,
    );
    expect(accessControlService.assertWorkspaceCan).toHaveBeenCalledWith(
      "read",
      InvitationEntity,
    );
    expect(em.fork).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(session);
  });

  it.each([MemberEntity, InvitationEntity])(
    "authorizes every child resource before reading workspace details: %s",
    async (denied) => {
      const { em, workspaceService, accessControlService } =
        createWorkspaceServices();
      vi.mocked(accessControlService.assertWorkspaceCan).mockImplementation(
        (_action, subject) => {
          if (subject === denied) throw new ForbiddenException();
        },
      );
      await expect(
        workspaceService.getFullWorkspace(createTestWorkspace()),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(em.find).not.toHaveBeenCalled();
    },
  );

  it("allows creator roles when adding members and inviting users", async () => {
    const { em, memberService, invitationService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const inviter = Object.assign(createTestUser(), {
      email: "owner@example.com",
      name: "Owner",
    });
    const user = Object.assign(createTestUser(), {
      email: "alice@example.com",
      name: "Alice",
    });
    em.findOne.mockResolvedValue(null);

    await expect(
      memberService.addMember(workspace, user, { roles: ["owner"] }),
    ).resolves.toMatchObject({ roles: ["owner"] });
    await expect(
      invitationService.createInvitation(workspace, inviter, {
        email: user.email,
        roles: ["owner"],
      }),
    ).resolves.toMatchObject({ roles: ["owner"] });

    const invitation = Object.assign(createTestInvitation(), {
      email: user.email,
      expiresAt: new Date(Date.now() + 60_000),
      roles: ["owner"],
      status: "pending" as const,
      workspace,
    });
    em.findOne.mockReset();
    em.findOne.mockResolvedValueOnce(invitation).mockResolvedValueOnce(null);
    await expect(
      invitationService.acceptInvitation(user, invitation.id),
    ).resolves.toMatchObject({ member: { roles: ["owner"] } });
  });

  it("rejects invalid invitation state transitions and missing members", async () => {
    const { em, invitationService, memberService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = Object.assign(createTestUser(), {
      email: "alice@example.com",
    });
    const completed = Object.assign(createTestInvitation(), {
      email: user.email,
      status: "accepted" as const,
      workspace,
    });

    await expect(invitationService.cancelInvitation(completed)).rejects.toThrow(
      "Workspace invitation is not pending",
    );
    await expect(
      invitationService.rejectInvitation(user, completed),
    ).rejects.toThrow("Workspace invitation is not pending");

    const addressedToAnotherUser = Object.assign(createTestInvitation(), {
      email: "other@example.com",
      status: "pending" as const,
      workspace,
    });
    await expect(
      invitationService.rejectInvitation(user, addressedToAnotherUser),
    ).rejects.toThrow("Workspace invitation belongs to another email address");

    const member = Object.assign(createTestMember(), {
      roles: ["member"],
      workspace,
    });
    em.findOne.mockResolvedValue(null);
    await expect(memberService.removeMember(member)).rejects.toThrow(
      "Workspace member not found",
    );
  });
});
