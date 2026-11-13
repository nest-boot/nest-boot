/* eslint-disable @typescript-eslint/unbound-method */
import { LockMode } from "@mikro-orm/core";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException, NotFoundException } from "@nestjs/common";

import { withIdentity } from "../../../test/fixtures/conditional-authorization.fixture.js";
import { mockRlsContext } from "../../../test/mock-rls-context.js";
import {
  createTestUser,
  createTestWorkspace,
  createTestWorkspaceInvitation,
  createTestWorkspaceMember,
  createWorkspaceServices,
} from "../../../test/workspace-service.fixture.js";
import { ApiKey } from "../../api-key/entities/api-key.entity.js";
import type { ApiKeyObject } from "../../api-key/objects/api-key.object.js";
import { UserApiKey } from "../../api-key/objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../../api-key/objects/workspace-api-key.object.js";
import { AuthAbility } from "../../common/auth.ability.js";
import { omitCredentials } from "../../common/utils/omit-credentials.util.js";
import { SELECTED_WORKSPACE } from "../../core/constants/auth.constants.js";
import { Session } from "../../core/entities/session.entity.js";
import { User } from "../../core/entities/user.entity.js";
import { WorkspaceConnection } from "../connections/workspace.connection-definition.js";
import { WorkspaceMemberConnection } from "../connections/workspace-member.connection-definition.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceInvitation } from "../entities/workspace-invitation.entity.js";
import { WorkspaceMember } from "../entities/workspace-member.entity.js";

describe("WorkspaceService and cross-domain coordination", () => {
  it.each(["update", "delete"] as const)(
    "rejects platform %s of the selected workspace in an external transaction before writing",
    async (operation) => {
      const { workspaceService, em } = createWorkspaceServices();
      const workspace = createTestWorkspace();
      em.isInTransaction.mockReturnValue(true);
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(SELECTED_WORKSPACE, workspace);
          await expect(
            operation === "update"
              ? workspaceService.updatePlatformWorkspace(workspace.id, {
                  name: "Denied",
                })
              : workspaceService.deletePlatformWorkspace(workspace.id),
          ).rejects.toThrow(
            "Change the current workspace outside an active transaction",
          );
          expect(em.findOne).not.toHaveBeenCalled();
          expect(em.transactional).not.toHaveBeenCalled();
          expect(em.flush).not.toHaveBeenCalled();
          expect(em.nativeDelete).not.toHaveBeenCalled();
          expect(RequestContext.get<Workspace | null>(SELECTED_WORKSPACE)).toBe(
            workspace,
          );
        },
      );
    },
  );
  it.each(["update", "delete"] as const)(
    "allows platform %s of another workspace in an external transaction",
    async (operation) => {
      const { workspaceService, em } = createWorkspaceServices();
      const current = createTestWorkspace();
      const target = Object.assign(new Workspace(), {
        id: "other",
        name: "Other",
      });
      em.isInTransaction.mockReturnValue(true);
      em.findOne.mockResolvedValue(target);
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(SELECTED_WORKSPACE, current);
          await expect(
            operation === "update"
              ? workspaceService.updatePlatformWorkspace(target.id, {
                  name: "Updated",
                })
              : workspaceService.deletePlatformWorkspace(target.id),
          ).resolves.toBe(target);
          expect(RequestContext.get<Workspace | null>(SELECTED_WORKSPACE)).toBe(
            current,
          );
        },
      );
    },
  );
  it.each(["member", "member-key"] as const)(
    "refreshes workspace-profile-dependent abilities after commit for a %s",
    async (principal) => {
      const { workspaceService, em } = createWorkspaceServices({
        buildAbility: ({ cannot }, { workspace }) => {
          if (!workspace) {
            return;
          }
          if (workspace.name === "Locked") {
            cannot("delete", Workspace);
          }
        },
      });
      const workspace = createTestWorkspace();
      em.findOne.mockResolvedValue(workspace);
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          const ability = new AuthAbility([
            { action: "delete", subject: Workspace },
          ]);
          RequestContext.set(SELECTED_WORKSPACE, workspace);
          RequestContext.set(AuthAbility, ability);
          if (principal === "member") {
            RequestContext.set(
              WorkspaceMember,
              Object.assign(createTestWorkspaceMember(), { roles: ["owner"] }),
            );
          } else {
            RequestContext.set<ApiKeyObject | null>(
              ApiKey,
              Object.assign(new WorkspaceApiKey(new ApiKey()), {
                permissions: ["workspace:update", "workspace:delete"],
              }),
            );
          }
          em.flush.mockRejectedValueOnce(new Error("Commit failed"));
          await expect(
            workspaceService.updateWorkspace(workspace.id, { name: "Locked" }),
          ).rejects.toThrow("Commit failed");
          expect.soft(workspace.name).toBe("Acme");
          expect(RequestContext.get(AuthAbility)).toBe(ability);
          em.flush.mockImplementationOnce(() => {
            expect(RequestContext.get(AuthAbility)).toBe(ability);
            return Promise.resolve();
          });
          await workspaceService.updateWorkspace(workspace.id, {
            name: "Locked",
          });
          expect(
            RequestContext.get<Workspace | null>(SELECTED_WORKSPACE)?.name,
          ).toBe("Locked");
          expect(
            RequestContext.get(AuthAbility)?.can("delete", Workspace),
          ).toBe(false);
        },
      );
    },
  );
  it("updates by ID using write authorization without requiring read permission", async () => {
    const { workspaceService, em, authorization } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    em.findOne.mockResolvedValue(workspace);
    vi.mocked(authorization.authorize).mockImplementation((action) => {
      if (action === "read") {
        throw new ForbiddenException();
      }
    });
    await expect(
      workspaceService.updateWorkspace(workspace.id, { name: "Renamed" }),
    ).resolves.toBe(workspace);
    expect(em.findOne).toHaveBeenCalledWith(
      Workspace,
      { id: workspace.id },
      { refresh: true },
    );
    expect(authorization.authorize).toHaveBeenNthCalledWith(
      1,
      "update",
      Workspace,
    );
    expect(authorization.authorize).toHaveBeenNthCalledWith(
      2,
      "update",
      workspace,
    );
    expect(authorization.assertCurrentWorkspace).toHaveBeenCalledWith(
      workspace,
    );
    expect(authorization.authorize).not.toHaveBeenCalledWith(
      "read",
      expect.anything(),
    );
    expect(workspace.name).toBe("Renamed");
    expect(em.flush).toHaveBeenCalledOnce();
  });
  it.each(["type", "instance", "missing"] as const)(
    "does not write when ID-based workspace authorization fails at %s",
    async (failure) => {
      const { workspaceService, em, authorization } = createWorkspaceServices();
      const workspace = createTestWorkspace();
      em.findOne.mockResolvedValue(failure === "missing" ? null : workspace);
      vi.mocked(authorization.authorize).mockImplementation(
        (_action, subject) => {
          if (
            (failure === "type" && subject === Workspace) ||
            (failure === "instance" && subject === workspace)
          ) {
            throw new ForbiddenException();
          }
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
    const { workspaceService, workspaceMemberService, em, authorization } =
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
        workspaceMemberService.getWorkspaceMemberConnectionByWorkspace(
          workspace,
          args,
        ),
      ).resolves.toBe(result);
      expect(find).toHaveBeenLastCalledWith(WorkspaceMemberConnection, args, {
        where: { workspace },
      });
      expect(find.mock.instances[0]).toHaveProperty("em", em);
      expect(authorization.assertCurrentWorkspace).toHaveBeenCalledWith(
        workspace,
      );
      expect(authorization.authorize).toHaveBeenCalledWith(
        "read",
        WorkspaceMember,
      );
      find.mockClear();
      vi.mocked(authorization.assertUserSession).mockImplementation(() => {
        throw new ForbiddenException();
      });
      vi.mocked(authorization.assertCurrentWorkspace).mockImplementation(() => {
        throw new ForbiddenException();
      });
      await expect(
        workspaceService.getWorkspaceConnectionByUser(user, args),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        workspaceMemberService.getWorkspaceMemberConnectionByWorkspace(
          workspace,
          args,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(find).not.toHaveBeenCalled();
    } finally {
      find.mockRestore();
    }
  });
  it("only returns a workspace to its active user member", async () => {
    const { workspaceService, em, authorization } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = createTestUser();
    em.findOne
      .mockResolvedValueOnce(workspace)
      .mockResolvedValueOnce(createTestWorkspaceMember());
    await expect(
      workspaceService.getUserWorkspace(workspace.id, user),
    ).resolves.toBe(workspace);
    expect(authorization.assertCurrentUser).toHaveBeenCalledWith(user);
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
    const { workspaceService, workspaceMemberService } =
      createWorkspaceServices();
    expect(workspaceService.getCurrentWorkspace()).toBeNull();
    expect(workspaceMemberService.getCurrentWorkspaceMember()).toBeNull();
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      const workspace = createTestWorkspace();
      const user = createTestUser();
      RequestContext.set(SELECTED_WORKSPACE, workspace);
      RequestContext.set(User, user);
      expect(() => workspaceService.getCurrentWorkspace()).toThrow(
        ForbiddenException,
      );
      const apiKey = new WorkspaceApiKey(new ApiKey());
      RequestContext.set<ApiKeyObject | null>(ApiKey, apiKey);
      expect(() => workspaceService.getCurrentWorkspace()).toThrow(
        "The API key owner is not a member of this workspace",
      );
      expect(() => workspaceMemberService.getCurrentWorkspaceMember()).toThrow(
        ForbiddenException,
      );
      const member = Object.assign(createTestWorkspaceMember(), { user });
      Object.assign(apiKey, { member });
      RequestContext.set(WorkspaceMember, member);
      expect(workspaceMemberService.getCurrentWorkspaceMember()).toBe(member);
      expect(workspaceService.getCurrentWorkspace()).toBe(workspace);
      member.status = "DISABLED";
      expect(() => workspaceMemberService.getCurrentWorkspaceMember()).toThrow(
        ForbiddenException,
      );
      expect(() => workspaceService.getCurrentWorkspace()).toThrow(
        ForbiddenException,
      );
    });
  });
  it.each(["member", "invitation", "delete"] as const)(
    "rechecks deleted workspace state under a row lock before %s",
    async (operation) => {
      const sendWorkspaceInvitationEmail = vi.fn();
      const {
        workspaceMemberService,
        workspaceInvitationService,
        workspaceService,
        em,
      } = createWorkspaceServices({ sendWorkspaceInvitationEmail });
      const workspace = createTestWorkspace();
      const user = Object.assign(createTestUser(), {
        email: "alice@example.com",
      });
      em.refreshOrFail.mockRejectedValue(
        new NotFoundException("Workspace not found"),
      );
      const operations = {
        member: () =>
          workspaceMemberService.addWorkspaceMember(workspace, user),
        invitation: () =>
          workspaceInvitationService.createWorkspaceInvitation(
            workspace,
            user,
            {
              email: "invitee@example.com",
            },
          ),
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
      expect(sendWorkspaceInvitationEmail).not.toHaveBeenCalled();
    },
  );
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("fails before persistence when a service-level permission is denied", async () => {
    const { authorization, em, workspaceService } = createWorkspaceServices();
    vi.mocked(authorization.authorize).mockImplementation(() => {
      throw new ForbiddenException();
    });
    await expect(
      workspaceService.updateWorkspace(createTestWorkspace(), {
        name: "Denied",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.assign).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });
  it.each(["assertCurrentUser", "authorize"] as const)(
    "checks %s before starting unrestricted workspace creation",
    async (check) => {
      const { authorization, em, workspaceService } = createWorkspaceServices();
      (authorization[check] as import("vitest").Mock).mockImplementation(() => {
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
      WorkspaceMember,
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
    const { em, workspaceService, workspaceMemberService } =
      createWorkspaceServices({
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
    await workspaceMemberService.addWorkspaceMember(
      createTestWorkspace(),
      user,
    );
    expect(em.create).toHaveBeenNthCalledWith(
      2,
      WorkspaceMember,
      expect.objectContaining({ roles: ["founder"] }),
    );
    expect(em.create).toHaveBeenNthCalledWith(
      3,
      WorkspaceMember,
      expect.objectContaining({ roles: ["viewer"] }),
    );
    expect(
      workspaceMemberService.getEffectiveWorkspaceMemberPermissions(
        Object.assign(createTestWorkspaceMember(), { roles: undefined }),
      ),
    ).toEqual([]);
  });
  it("uses delete ability independently of the configured creator role", async () => {
    const { workspaceService, authorization } = createWorkspaceServices({
      creatorRole: "founder",
      defaultRole: "viewer",
      permissions: [],
      roles: { founder: [], viewer: [] },
    });
    const workspace = createTestWorkspace();
    await expect(workspaceService.deleteWorkspace(workspace)).resolves.toBe(
      workspace,
    );
    expect(authorization.authorize).toHaveBeenLastCalledWith(
      "delete",
      workspace,
    );
  });
  it("updates mutable workspace fields", async () => {
    const { authorization, em, workspaceService } = createWorkspaceServices();
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
    expect(authorization.assertCurrentWorkspace).toHaveBeenCalledWith(
      workspace,
    );
  });
  it("rejects workspace deletion without delete ability", async () => {
    const { em, workspaceService, authorization } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    vi.mocked(authorization.authorize).mockImplementation(() => {
      throw new ForbiddenException();
    });
    await expect(
      workspaceService.deleteWorkspace(workspace),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.flush).not.toHaveBeenCalled();
  });
  it("does not let a caller delete a different workspace", async () => {
    const { em, workspaceService, authorization } = createWorkspaceServices();
    vi.mocked(authorization.assertCurrentWorkspace).mockImplementation(() => {
      throw new ForbiddenException();
    });
    await expect(
      workspaceService.deleteWorkspace(createTestWorkspace()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.flush).not.toHaveBeenCalled();
  });
  it("rechecks delete ability after locking and refreshing the workspace", async () => {
    const { em, workspaceService, authorization } = createWorkspaceServices();
    vi.mocked(authorization.authorize)
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
  it.each(["session", "user-key", "member-key"])(
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
            kind === "member-key"
              ? new WorkspaceApiKey(new ApiKey())
              : kind === "user-key"
                ? new UserApiKey(new ApiKey())
                : null;
          RequestContext.set<ApiKeyObject | null>(ApiKey, key);
          if (kind !== "member-key") {
            RequestContext.set(User, user);
          }
          if (kind === "session") {
            RequestContext.set(Session, session);
          }
          RequestContext.set(SELECTED_WORKSPACE, workspace);
          RequestContext.set(WorkspaceMember, createTestWorkspaceMember());
          em.nativeDelete.mockImplementation(() => {
            expect(em.setSessionContext).not.toHaveBeenCalled();
            expect(em.getSessionContext()).toEqual(sessionContext);
            return Promise.resolve(1);
          });
          await expect(
            workspaceService.deleteWorkspace(workspace),
          ).resolves.toBe(workspace);
          expect(
            RequestContext.get<Workspace | null>(SELECTED_WORKSPACE),
          ).toBeNull();
          expect(RequestContext.get(WorkspaceMember)).toBeNull();
          if (kind === "member-key") {
            expect(RequestContext.get(ApiKey)).toBeNull();
            expect(RequestContext.get(User)).toBeNull();
            expect(RequestContext.get(Session)).toBeNull();
            expect(RequestContext.get(AuthAbility)?.rules).toEqual([]);
            expect(em.setSessionContext).toHaveBeenCalledWith({
              role: "anonymous",
              variables: {
                "app.auth.user.id": "",
                "app.auth.workspace.id": "",
                "app.selected.workspace.id": "",
                "app.auth.workspace_member.id": "",
              },
            });
          } else {
            expect(RequestContext.get(ApiKey)).toBe(key);
            expect(RequestContext.get(User)).toBe(user);
            if (kind === "session") {
              expect(RequestContext.get(Session)).toBe(session);
            }
            expect(em.setSessionContext).toHaveBeenCalledWith(
              expect.objectContaining({
                variables: expect.objectContaining({
                  "app.auth.workspace.id": "",
                }),
              }),
            );
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
      RequestContext.set(SELECTED_WORKSPACE, workspace);
      const key = new WorkspaceApiKey(new ApiKey());
      RequestContext.set<ApiKeyObject | null>(ApiKey, key);
      em.transactional.mockImplementationOnce(async (callback) => {
        await callback(em);
        throw new Error("Commit failed");
      });
      await expect(workspaceService.deleteWorkspace(workspace)).rejects.toThrow(
        "Commit failed",
      );
      expect(RequestContext.get<Workspace | null>(SELECTED_WORKSPACE)).toBe(
        workspace,
      );
      expect(RequestContext.get(ApiKey)).toBe(key);
      expect(em.setSessionContext).not.toHaveBeenCalled();
    });
  });
  it("does not clear workspace authorization when the scoped delete affects no row", async () => {
    const { em, workspaceService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const member = createTestWorkspaceMember();
    em.nativeDelete.mockResolvedValueOnce(0);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const session = mockRlsContext(em);
      RequestContext.set(SELECTED_WORKSPACE, workspace);
      RequestContext.set(WorkspaceMember, member);
      await expect(workspaceService.deleteWorkspace(workspace)).rejects.toThrow(
        "Workspace not found",
      );
      expect(RequestContext.get<Workspace | null>(SELECTED_WORKSPACE)).toBe(
        workspace,
      );
      expect(RequestContext.get(WorkspaceMember)).toBe(member);
      expect(em.getSessionContext()).toBe(session);
      expect(em.setSessionContext).not.toHaveBeenCalled();
    });
  });
  it("finds workspaces and memberships through the public lookup APIs", async () => {
    const { em, workspaceService, workspaceMemberService } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = createTestUser();
    const member = Object.assign(createTestWorkspaceMember(), { workspace });
    em.findOne.mockResolvedValueOnce(workspace).mockResolvedValueOnce(member);
    em.find.mockResolvedValue([member]);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(SELECTED_WORKSPACE, workspace);
      await expect(
        workspaceService.findOne({ id: workspace.id }),
      ).resolves.toBe(workspace);
    });
    await expect(
      workspaceMemberService.getWorkspaceMemberByUser(workspace, user),
    ).resolves.toBe(member);
    expect(em.findOne).toHaveBeenNthCalledWith(1, Workspace, {
      $and: [{ id: workspace.id }, { id: workspace.id }],
    });
    expect(em.findOne).toHaveBeenNthCalledWith(2, WorkspaceMember, {
      status: "ACTIVE",
      user,
      workspace,
    });
  });
  it("allows creator roles when adding members and inviting users", async () => {
    const { em, workspaceMemberService, workspaceInvitationService } =
      createWorkspaceServices();
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
      workspaceMemberService.addWorkspaceMember(workspace, user, {
        roles: ["owner"],
      }),
    ).resolves.toMatchObject({ roles: ["owner"] });
    await expect(
      workspaceInvitationService.createWorkspaceInvitation(workspace, inviter, {
        email: user.email,
        roles: ["owner"],
      }),
    ).resolves.toMatchObject({ roles: ["owner"] });
    const invitation = Object.assign(createTestWorkspaceInvitation(), {
      email: user.email,
      expiresAt: new Date(Date.now() + 60000),
      roles: ["owner"],
      status: "pending" as const,
      workspace,
    });
    em.findOne.mockReset();
    em.findOne.mockResolvedValueOnce(invitation).mockResolvedValueOnce(null);
    await expect(
      workspaceInvitationService.acceptWorkspaceInvitation(user, invitation.id),
    ).resolves.toMatchObject({ member: { roles: ["owner"] } });
  });
  it("rejects invalid invitation state transitions and missing members", async () => {
    const { em, workspaceInvitationService, workspaceMemberService } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = Object.assign(createTestUser(), {
      email: "alice@example.com",
    });
    const completed = Object.assign(createTestWorkspaceInvitation(), {
      email: user.email,
      status: "accepted" as const,
      workspace,
    });
    await expect(
      workspaceInvitationService.cancelWorkspaceInvitation(completed),
    ).rejects.toThrow("Workspace invitation is not pending");
    await expect(
      workspaceInvitationService.rejectWorkspaceInvitation(user, completed),
    ).rejects.toThrow("Workspace invitation is not pending");
    const addressedToAnotherUser = Object.assign(
      createTestWorkspaceInvitation(),
      {
        email: "other@example.com",
        status: "pending" as const,
        workspace,
      },
    );
    await expect(
      workspaceInvitationService.rejectWorkspaceInvitation(
        user,
        addressedToAnotherUser,
      ),
    ).rejects.toThrow("Workspace invitation belongs to another email address");
    const member = Object.assign(createTestWorkspaceMember(), {
      roles: ["member"],
      workspace,
    });
    em.findOne.mockResolvedValue(null);
    await expect(
      workspaceMemberService.removeWorkspaceMember(member),
    ).rejects.toThrow("Workspace member not found");
  });

  it("rejects current workspace profile updates inside an outer transaction", async () => {
    const { workspaceService, em } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    em.isInTransaction.mockReturnValue(true);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(SELECTED_WORKSPACE, workspace);
      await expect(
        workspaceService.updateWorkspace(workspace, { name: "Locked" }),
      ).rejects.toThrow("outside an active transaction");
      expect(workspace.name).toBe("Acme");
      expect(em.assign).not.toHaveBeenCalled();
      expect(em.flush).not.toHaveBeenCalled();
    });
  });
});

describe("conditional authorization", () => {
  describe("conditional service authorization", () => {
    it.each(
      (["member", "workspace"] as const).filter((_row, index) => index === 1),
    )("checks current %s reads against the context instance", async (kind) => {
      await withIdentity(({ workspaceMemberService, workspaceService }) => {
        const entity =
          kind === "member"
            ? RequestContext.get(WorkspaceMember)
            : RequestContext.get<Workspace | null>(SELECTED_WORKSPACE);
        if (!entity) {
          throw new Error("Missing test identity");
        }
        const read = () =>
          kind === "member"
            ? workspaceMemberService.getCurrentWorkspaceMember()
            : workspaceService.getCurrentWorkspace();
        expect(read()).toBe(entity);
        entity.id = "blocked";
        expect(() => read()).toThrow(ForbiddenException);
        entity.id = "allowed";
        RequestContext.set(
          AuthAbility,
          new AuthAbility([
            {
              action: "read",
              subject: kind === "member" ? "WorkspaceMember" : "Workspace",
              inverted: true,
            },
          ]),
        );
        expect(() => read()).toThrow(ForbiddenException);
        RequestContext.set(AuthAbility, null);
        expect(() => read()).toThrow(ForbiddenException);
        RequestContext.set(WorkspaceMember, null);
        RequestContext.set(SELECTED_WORKSPACE, null);
        expect(read()).toBeNull();
      });
    });
    it.each(
      (
        [
          "member",
          "user-invitation",
          "workspace-invitation",
          "workspace",
        ] as const
      ).filter((_row, index) => index === 3),
    )(
      "enforces the ownership or ability boundary for a single %s read",
      async (kind) => {
        await withIdentity(
          async ({
            workspaceMemberService,
            workspaceInvitationService,
            workspaceService,
            em,
            user,
            workspace,
          }) => {
            const entity = Object.assign(
              kind === "member"
                ? new WorkspaceMember()
                : kind === "workspace"
                  ? new Workspace()
                  : new WorkspaceInvitation(),
              { id: "blocked", workspace, email: user.email },
            );
            em.findOne.mockResolvedValue(entity);
            const read = () =>
              kind === "member"
                ? workspaceMemberService.getWorkspaceMember(entity.id)
                : kind === "workspace"
                  ? workspaceService.findOne({ id: entity.id })
                  : kind === "user-invitation"
                    ? workspaceInvitationService.getWorkspaceInvitationByUser(
                        entity.id,
                        user,
                      )
                    : workspaceInvitationService.getWorkspaceInvitationByWorkspace(
                        entity.id,
                        workspace,
                      );
            if (kind === "user-invitation") {
              await expect(read()).resolves.toBe(entity);
              expect(em.findOne).toHaveBeenLastCalledWith(WorkspaceInvitation, {
                id: entity.id,
                email: user.email.toLowerCase(),
              });
            } else {
              await expect(read()).rejects.toThrow(ForbiddenException);
            }
            em.findOne.mockResolvedValue(null);
            await expect(read()).resolves.toBeNull();
          },
        );
      },
    );
    it.each(
      (
        [
          "member",
          "user-invitation",
          "workspace-invitation",
          "user",
          "workspace",
          "session",
        ] as const
      ).filter((_row, index) => index === 4),
    )(
      "uses the ownership or instance-ability boundary for %s connections",
      async (kind) => {
        await withIdentity(
          async ({
            workspaceMemberService,
            workspaceInvitationService,
            workspaceService,
            userService,
            sessionService,
            user,
            workspace,
          }) => {
            const Entity =
              kind === "member"
                ? WorkspaceMember
                : kind === "user"
                  ? User
                  : kind === "workspace"
                    ? Workspace
                    : kind === "session"
                      ? Session
                      : WorkspaceInvitation;
            const node = Object.assign(new Entity(), { id: "allowed" });
            const result = {
              edges: [{ node, cursor: "cursor" }],
              pageInfo: { hasNextPage: true },
              totalCount: 2,
            };
            vi.spyOn(ConnectionManager.prototype, "find").mockResolvedValue(
              result as never,
            );
            const read = () =>
              kind === "member"
                ? workspaceMemberService.getWorkspaceMemberConnectionByWorkspace(
                    workspace,
                    {
                      first: 1,
                    },
                  )
                : kind === "user"
                  ? userService.getUserConnection({ first: 1 })
                  : kind === "workspace"
                    ? workspaceService.getWorkspaceConnectionByUser(user, {
                        first: 1,
                      })
                    : kind === "session"
                      ? sessionService.getSessionConnectionByUser(
                          Object.assign(new User(), { id: "other" }),
                          { first: 1 },
                        )
                      : kind === "user-invitation"
                        ? workspaceInvitationService.getWorkspaceInvitationConnectionByUser(
                            user,
                            {
                              first: 1,
                            },
                          )
                        : workspaceInvitationService.getWorkspaceInvitationConnectionByWorkspace(
                            workspace,
                            { first: 1 },
                          );
            await expect(read()).resolves.toEqual({
              ...result,
              edges: result.edges.map((edge) => ({
                ...edge,
                node: omitCredentials(edge.node, [
                  "key",
                  "token",
                  "password",
                  "accessToken",
                  "refreshToken",
                  "idToken",
                ]),
              })),
            });
            node.id = "blocked";
            if (kind === "workspace") {
              await expect(read()).resolves.toEqual({
                ...result,
                edges: result.edges.map((edge) => ({
                  ...edge,
                  node: omitCredentials(edge.node, [
                    "key",
                    "token",
                    "password",
                    "accessToken",
                    "refreshToken",
                    "idToken",
                  ]),
                })),
              });
              expect(ConnectionManager.prototype.find).toHaveBeenLastCalledWith(
                expect.anything(),
                { first: 1 },
                expect.objectContaining({
                  where: expect.objectContaining({ id: expect.anything() }),
                }),
              );
            } else if (kind === "user-invitation") {
              await expect(read()).resolves.toEqual({
                ...result,
                edges: result.edges.map((edge) => ({
                  ...edge,
                  node: omitCredentials(edge.node, [
                    "key",
                    "token",
                    "password",
                    "accessToken",
                    "refreshToken",
                    "idToken",
                  ]),
                })),
              });
              expect(ConnectionManager.prototype.find).toHaveBeenLastCalledWith(
                expect.anything(),
                { first: 1 },
                expect.objectContaining({
                  where: expect.objectContaining({
                    email: user.email.toLowerCase(),
                    status: "pending",
                  }),
                }),
              );
            } else {
              await expect(read()).rejects.toThrow(ForbiddenException);
            }
            expect(result.edges).toHaveLength(1);
            expect(result.totalCount).toBe(2);
          },
        );
      },
    );
    it.each(
      (
        [
          "user",
          "workspace",
          "member",
          "invitation",
          "user-key",
          "member-key",
        ] as const
      ).filter((_row, index) => index === 1),
    )("checks proposed %s fields before creation", async (kind) => {
      await withIdentity(
        async ({
          em,
          user,
          workspace,
          workspaceMemberService,
          workspaceInvitationService,
          workspaceService,
          userService,
          userApiKeyService,
          workspaceApiKeyService,
        }) => {
          em.findOne.mockResolvedValue(null);
          const create = () =>
            kind === "user"
              ? userService.createUser({
                  name: "blocked",
                  email: "new@example.com",
                  password: "valid-password",
                })
              : kind === "workspace"
                ? workspaceService.createWorkspace(user, { name: "blocked" })
                : kind === "member"
                  ? workspaceMemberService.addWorkspaceMember(
                      workspace,
                      Object.assign(new User(), {
                        id: "invitee",
                        name: "blocked",
                        email: "new@example.com",
                      }),
                    )
                  : kind === "invitation"
                    ? workspaceInvitationService.createWorkspaceInvitation(
                        workspace,
                        user,
                        {
                          email: "blocked@example.com",
                        },
                      )
                    : kind === "user-key"
                      ? userApiKeyService.createUserApiKey(user, {
                          name: "blocked",
                        })
                      : workspaceApiKeyService.createWorkspaceApiKey(
                          workspace,
                          {
                            name: "blocked",
                          },
                        );
          await expect(create()).rejects.toThrow(ForbiddenException);
          expect(em.persist).not.toHaveBeenCalled();
        },
      );
    });
  });
});
