/* eslint-disable @typescript-eslint/unbound-method */
import { LockMode } from "@mikro-orm/core";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException, NotFoundException } from "@nestjs/common";

import { mockRlsContext } from "../../test/mock-rls-context.js";
import {
  createTestInvitation,
  createTestMember,
  createTestUser,
  createTestWorkspace,
  createWorkspaceServices,
} from "../../test/workspace-service.fixture.js";
import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { API_KEY } from "../auth.constants.js";
import { MemberConnection } from "../connections/member.connection-definition.js";
import { WorkspaceConnection } from "../connections/workspace.connection-definition.js";
import { Member } from "../entities/member.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";

describe("WorkspaceService and cross-domain coordination", () => {
  it.each(["member", "workspace-key"] as const)(
    "refreshes workspace-profile-dependent abilities after commit for a %s",
    async (principal) => {
      const { workspaceService, em } = createWorkspaceServices({
        buildAbility: ({ cannot }, _permissions, workspace) => {
          if (workspace.name === "Locked") cannot("delete", Workspace);
        },
      });
      const workspace = createTestWorkspace();
      em.findOne.mockResolvedValue(workspace);
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          const ability = new WorkspaceAbility([
            { action: "delete", subject: Workspace },
          ]);
          RequestContext.set(Workspace, workspace);
          RequestContext.set(WorkspaceAbility, ability);
          if (principal === "member") {
            RequestContext.set(
              Member,
              Object.assign(createTestMember(), { roles: ["owner"] }),
            );
          } else {
            RequestContext.set(
              API_KEY,
              Object.assign(new WorkspaceApiKey(), {
                permissions: ["workspace:update", "workspace:delete"],
              }),
            );
          }
          em.flush.mockRejectedValueOnce(new Error("Commit failed"));
          await expect(
            workspaceService.updateWorkspace(workspace.id, { name: "Locked" }),
          ).rejects.toThrow("Commit failed");
          expect.soft(workspace.name).toBe("Acme");
          expect(RequestContext.get(WorkspaceAbility)).toBe(ability);
          em.flush.mockImplementationOnce(() => {
            expect(RequestContext.get(WorkspaceAbility)).toBe(ability);
            return Promise.resolve();
          });
          await workspaceService.updateWorkspace(workspace.id, {
            name: "Locked",
          });
          expect(RequestContext.get(Workspace)?.name).toBe("Locked");
          expect(
            RequestContext.get(WorkspaceAbility)?.can("delete", Workspace),
          ).toBe(false);
        },
      );
    },
  );

  it("rejects current workspace profile updates inside an outer transaction", async () => {
    const { workspaceService, em } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    em.isInTransaction.mockReturnValue(true);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(Workspace, workspace);
      await expect(
        workspaceService.updateWorkspace(workspace, { name: "Locked" }),
      ).rejects.toThrow("outside an active transaction");
      expect(workspace.name).toBe("Acme");
      expect(em.assign).not.toHaveBeenCalled();
      expect(em.flush).not.toHaveBeenCalled();
    });
  });

  it("updates by ID using write authorization without requiring read permission", async () => {
    const { workspaceService, em, accessControlService } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    em.findOne.mockResolvedValue(workspace);
    vi.mocked(accessControlService.assertUserCan).mockImplementation(() => {
      throw new ForbiddenException();
    });

    await expect(
      workspaceService.updateWorkspace(workspace.id, { name: "Renamed" }),
    ).resolves.toBe(workspace);
    expect(em.findOne).toHaveBeenCalledWith(
      Workspace,
      { id: workspace.id },
      { refresh: true },
    );
    expect(accessControlService.assertWorkspaceCan).toHaveBeenNthCalledWith(
      1,
      "update",
      Workspace,
    );
    expect(accessControlService.assertWorkspaceCan).toHaveBeenNthCalledWith(
      2,
      "update",
      workspace,
    );
    expect(accessControlService.assertCurrentWorkspace).toHaveBeenCalledWith(
      workspace,
    );
    expect(accessControlService.assertUserCan).not.toHaveBeenCalled();
    expect(workspace.name).toBe("Renamed");
    expect(em.flush).toHaveBeenCalledOnce();
  });

  it.each(["type", "instance", "missing"] as const)(
    "does not write when ID-based workspace authorization fails at %s",
    async (failure) => {
      const { workspaceService, em, accessControlService } =
        createWorkspaceServices();
      const workspace = createTestWorkspace();
      em.findOne.mockResolvedValue(failure === "missing" ? null : workspace);
      vi.mocked(accessControlService.assertWorkspaceCan).mockImplementation(
        (_action, subject) => {
          if (
            (failure === "type" && subject === Workspace) ||
            (failure === "instance" && subject === workspace)
          )
            throw new ForbiddenException();
        },
      );
      await expect(
        workspaceService.updateWorkspace(workspace.id, { name: "Denied" }),
      ).rejects.toThrow(
        failure === "missing" ? "Workspace not found" : "Forbidden",
      );
      expect(em.findOne).toHaveBeenCalledTimes(failure === "type" ? 0 : 1);
      expect(workspace.name).toBe("Acme");
      expect(em.assign).not.toHaveBeenCalled();
      expect(em.flush).not.toHaveBeenCalled();
    },
  );

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
        where: { id: { $in: subquery } },
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
        Member,
      );
      find.mockClear();
      vi.mocked(accessControlService.assertUserSession).mockImplementation(
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
      RequestContext.set(Workspace, workspace);
      RequestContext.set(User, user);
      expect(() => workspaceService.getCurrentWorkspace()).toThrow(
        ForbiddenException,
      );
      RequestContext.set(API_KEY, new WorkspaceApiKey());
      expect(() => workspaceService.getCurrentWorkspace()).toThrow(
        "The API key owner is not a member of this workspace",
      );
      expect(() => memberService.getCurrentMember()).toThrow(
        ForbiddenException,
      );
      const member = createTestMember();
      RequestContext.set(Member, member);
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
      em.refreshOrFail.mockRejectedValue(
        new NotFoundException("Workspace not found"),
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
        "Workspace not found",
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

    expect(em.create).toHaveBeenNthCalledWith(1, Workspace, {
      name: "Acme",
    });
    expect(em.create).toHaveBeenNthCalledWith(
      2,
      Member,
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
      Member,
      expect.objectContaining({ roles: ["founder"] }),
    );
    expect(em.create).toHaveBeenNthCalledWith(
      3,
      Member,
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

    expect(em.assign).toHaveBeenCalledWith(
      workspace,
      { name: "Renamed" },
      { ignoreUndefined: true },
    );
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
    expect(em.nativeDelete).not.toHaveBeenCalled();
  });

  it.each(["session", "user-key", "workspace-key"])(
    "clears only the revoked scope after workspace deletion with %s",
    async (kind) => {
      const { em, workspaceService } = createWorkspaceServices();
      const workspace = createTestWorkspace();
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          const sessionContext = mockRlsContext(em);
          const user = createTestUser();
          const session = new Session();
          const key =
            kind === "workspace-key"
              ? new WorkspaceApiKey()
              : kind === "user-key"
                ? new UserApiKey()
                : null;
          RequestContext.set(API_KEY, key);
          if (kind !== "workspace-key") RequestContext.set(User, user);
          if (kind === "session") RequestContext.set(Session, session);
          RequestContext.set(Workspace, workspace);
          RequestContext.set(Member, createTestMember());
          em.nativeDelete.mockImplementation(() => {
            expect(em.setSessionContext).not.toHaveBeenCalled();
            expect(em.getSessionContext()).toEqual(sessionContext);
            return Promise.resolve(1);
          });
          await expect(
            workspaceService.deleteWorkspace(workspace),
          ).resolves.toBe(workspace);
          expect(RequestContext.get(Workspace)).toBeNull();
          expect(RequestContext.get(Member)).toBeNull();
          if (kind === "workspace-key") {
            expect(RequestContext.get(API_KEY)).toBeNull();
            expect(RequestContext.get(User)).toBeNull();
            expect(RequestContext.get(Session)).toBeNull();
            expect(RequestContext.get(UserAbility)?.rules).toEqual([]);
            expect(RequestContext.get(WorkspaceAbility)?.rules).toEqual([]);
            expect(em.setSessionContext).toHaveBeenCalledWith({
              role: "anonymous",
              variables: { "app.user.id": "", "app.workspace.id": "" },
            });
          } else {
            expect(RequestContext.get(API_KEY)).toBe(key);
            expect(RequestContext.get(User)).toBe(user);
            if (kind === "session")
              expect(RequestContext.get(Session)).toBe(session);
            expect(em.setSessionContext).toHaveBeenCalledWith({
              variables: { "app.workspace.id": "" },
            });
          }
          expect(em.fork).not.toHaveBeenCalled();
          expect(em.nativeDelete).toHaveBeenCalledExactlyOnceWith(Workspace, {
            id: workspace.id,
          });
        },
      );

      expect(em.nativeUpdate).not.toHaveBeenCalled();
    },
  );

  it("rejects deletion in an outer transaction and leaves the scope unchanged after a failed commit", async () => {
    const { em, workspaceService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(Workspace, workspace);
      const key = new WorkspaceApiKey();
      RequestContext.set(API_KEY, key);
      em.isInTransaction.mockReturnValueOnce(true);
      await expect(workspaceService.deleteWorkspace(workspace)).rejects.toThrow(
        "outside an active transaction",
      );
      expect(em.transactional).not.toHaveBeenCalled();
      em.transactional.mockImplementationOnce(async (callback) => {
        await callback(em);
        throw new Error("Commit failed");
      });
      await expect(workspaceService.deleteWorkspace(workspace)).rejects.toThrow(
        "Commit failed",
      );
      expect(RequestContext.get(Workspace)).toBe(workspace);
      expect(RequestContext.get(API_KEY)).toBe(key);
      expect(em.setSessionContext).not.toHaveBeenCalled();
    });
  });

  it("does not clear workspace authorization when the scoped delete affects no row", async () => {
    const { em, workspaceService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const member = createTestMember();
    em.nativeDelete.mockResolvedValueOnce(0);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const session = mockRlsContext(em);
      RequestContext.set(Workspace, workspace);
      RequestContext.set(Member, member);

      await expect(workspaceService.deleteWorkspace(workspace)).rejects.toThrow(
        "Workspace not found",
      );
      expect(RequestContext.get(Workspace)).toBe(workspace);
      expect(RequestContext.get(Member)).toBe(member);
      expect(em.getSessionContext()).toBe(session);
      expect(em.setSessionContext).not.toHaveBeenCalled();
    });
  });

  it("finds workspaces and memberships through the public lookup APIs", async () => {
    const { em, workspaceService, memberService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = createTestUser();
    const member = Object.assign(createTestMember(), { workspace });
    em.findOne.mockResolvedValueOnce(workspace).mockResolvedValueOnce(member);
    em.find.mockResolvedValue([member]);

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(Workspace, workspace);
      await expect(
        workspaceService.findOne({ id: workspace.id }),
      ).resolves.toBe(workspace);
    });
    await expect(memberService.getMemberByUser(workspace, user)).resolves.toBe(
      member,
    );

    expect(em.findOne).toHaveBeenNthCalledWith(1, Workspace, {
      $and: [{ id: workspace.id }, { id: workspace.id }],
    });
    expect(em.findOne).toHaveBeenNthCalledWith(2, Member, {
      status: "ACTIVE",
      user,
      workspace,
    });
  });

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
