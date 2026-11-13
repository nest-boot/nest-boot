/* eslint-disable @typescript-eslint/unbound-method */
import { LockMode, ref } from "@mikro-orm/core";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import { BadRequestException, ForbiddenException } from "@nestjs/common";

import { createTestAuthContext } from "../../../test/fixtures/auth-context.fixture.js";
import { withIdentity } from "../../../test/fixtures/conditional-authorization.fixture.js";
import { withAuthTestFeatures } from "../../../test/fixtures/enabled-auth-features.fixture.js";
import { restoreAuthorization } from "../../../test/mock-authorization.js";
import { mockRlsContext } from "../../../test/mock-rls-context.js";
import {
  createTestUser,
  createTestWorkspace,
  createTestWorkspaceMember,
  createWorkspaceServices,
} from "../../../test/workspace-service.fixture.js";
import { ApiKey } from "../../api-key/entities/api-key.entity.js";
import type { ApiKeyObject } from "../../api-key/objects/api-key.object.js";
import { UserApiKey } from "../../api-key/objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../../api-key/objects/workspace-api-key.object.js";
import { AuthAbility } from "../../common/auth.ability.js";
import { can } from "../../common/utils/can.util.js";
import { omitCredentials } from "../../common/utils/omit-credentials.util.js";
import {
  assertCanGrantPermissions,
  canGrantPermissions,
} from "../../common/utils/permission-grants.util.js";
import { createAuthAbility } from "../../core/auth-ability.factory.js";
import { SELECTED_WORKSPACE } from "../../core/constants/auth.constants.js";
import { Session } from "../../core/entities/session.entity.js";
import { User } from "../../core/entities/user.entity.js";
import {
  DEFAULT_WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLES,
} from "../constants/workspace.constants.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceInvitation } from "../entities/workspace-invitation.entity.js";
import { WorkspaceMember } from "../entities/workspace-member.entity.js";
import { WorkspaceMemberType } from "../enums/workspace-member-type.enum.js";
import { WorkspaceMemberService } from "./workspace-member.service.js";

describe("WorkspaceMemberService", () => {
  it.each([
    { roles: undefined, permissions: [], expectedRoles: ["member"] },
    { roles: [], permissions: ["workspace:update"], expectedRoles: [] },
  ])(
    "creates service accounts with workspace grants and no login user ($permissions)",
    async ({ roles, permissions, expectedRoles }) => {
      const { workspaceMemberService, em } = createWorkspaceServices();
      const workspace = createTestWorkspace();
      const member = await workspaceMemberService.addWorkspaceServiceAccount(
        workspace,
        " CI deployer ",
        { roles, permissions },
      );
      expect(member).toMatchObject({
        name: "CI deployer",
        type: WorkspaceMemberType.SERVICE_ACCOUNT,
        user: null,
        email: null,
        workspace,
        roles: expectedRoles,
        permissions,
        status: "ACTIVE",
      });
      expect(em.persist).toHaveBeenCalledWith(member);
      expect(em.nativeUpdate).not.toHaveBeenCalled();
      await expect(
        workspaceMemberService.getWorkspaceMemberUser(member),
      ).resolves.toBeNull();
    },
  );
  it.each([
    ["workspace-member:read", WorkspaceMemberType.USER],
    ["workspace-service-account:read", WorkspaceMemberType.SERVICE_ACCOUNT],
  ] as const)(
    "scopes member pagination and lookup for %s",
    async (permission, type) => {
      const { workspaceMemberService, em } = createWorkspaceServices();
      const workspace = createTestWorkspace();
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          restoreAuthorization();
          RequestContext.set(User, createTestUser());
          RequestContext.set(SELECTED_WORKSPACE, workspace);
          RequestContext.set(
            AuthAbility,
            createAuthAbility(
              {
                user: createTestUser(),
                member: null,
                workspace,
                userPermissions: [],
                workspacePermissions: [permission],
              },
              withAuthTestFeatures({ workspace: { enabled: true } }),
            ),
          );
          expect(
            workspaceMemberService.getWorkspaceMemberListFilter(workspace),
          ).toEqual({
            workspace,
            type: { $in: [type] },
          });
          await workspaceMemberService.getWorkspaceMember("target-member");
          expect(em.findOne).toHaveBeenCalledWith(WorkspaceMember, {
            id: "target-member",
            workspace,
            type: { $in: [type] },
          });
        },
      );
    },
  );
  it("rejects service account creation with only ordinary member write permission", async () => {
    const { workspaceMemberService, em } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      restoreAuthorization();
      RequestContext.set(User, createTestUser());
      RequestContext.set(SELECTED_WORKSPACE, workspace);
      RequestContext.set(
        AuthAbility,
        createAuthAbility(
          {
            user: createTestUser(),
            member: null,
            workspace,
            userPermissions: [],
            workspacePermissions: ["workspace-member:write"],
          },
          withAuthTestFeatures({ workspace: { enabled: true } }),
        ),
      );
      await expect(
        workspaceMemberService.addWorkspaceServiceAccount(workspace, "CI"),
      ).rejects.toThrow(ForbiddenException);
    });
    expect(em.transactional).not.toHaveBeenCalled();
    expect(em.persist).not.toHaveBeenCalled();
  });
  it.each([
    ["workspace-member:write", WorkspaceMemberType.SERVICE_ACCOUNT],
    ["workspace-service-account:write", WorkspaceMemberType.USER],
  ] as const)(
    "rejects updates and removals of %s's excluded member type",
    async (permission, type) => {
      const { workspaceMemberService, em } = createWorkspaceServices();
      const workspace = createTestWorkspace();
      const target = Object.assign(createTestWorkspaceMember(), {
        id: "other-member",
        type,
      });
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          restoreAuthorization();
          RequestContext.set(User, createTestUser());
          RequestContext.set(SELECTED_WORKSPACE, workspace);
          RequestContext.set(
            AuthAbility,
            createAuthAbility(
              {
                user: createTestUser(),
                member: null,
                workspace,
                userPermissions: [],
                workspacePermissions: [permission],
              },
              withAuthTestFeatures({ workspace: { enabled: true } }),
            ),
          );
          await expect(
            workspaceMemberService.updateWorkspaceMember(target, {
              name: "Changed",
            }),
          ).rejects.toThrow(ForbiddenException);
          await expect(
            workspaceMemberService.removeWorkspaceMember(target),
          ).rejects.toThrow(ForbiddenException);
        },
      );
      expect(em.transactional).not.toHaveBeenCalled();
      expect(em.remove).not.toHaveBeenCalled();
    },
  );
  it("rejects invalid service account names before persistence", async () => {
    const { workspaceMemberService, em } = createWorkspaceServices();
    for (const name of [" ", "x".repeat(256)]) {
      await expect(
        workspaceMemberService.addWorkspaceServiceAccount(
          createTestWorkspace(),
          name,
        ),
      ).rejects.toThrow("service account name");
    }
    expect(em.persist).not.toHaveBeenCalled();
  });
  it.each(["roles", "permissions"] as const)(
    "publishes own %s only after commit and revokes stale workspace authorization",
    async (field) => {
      const { workspaceMemberService, em } = createWorkspaceServices({
        permissions: ["workspace:delete"],
        roles: { owner: ["workspace:delete"], member: [] },
      });
      const workspace = createTestWorkspace();
      const user = createTestUser();
      const current = Object.assign(createTestWorkspaceMember(), {
        user,
        roles: ["owner"],
      });
      const locked = Object.assign(createTestWorkspaceMember(), {
        user,
        roles: field === "permissions" ? ["member"] : ["owner"],
        permissions: field === "permissions" ? ["workspace:delete"] : [],
      });
      mockRlsContext(em).variables = {
        "app.auth.user.id": user.id,
        "app.auth.workspace.id": workspace.id,
        "app.selected.workspace.id": workspace.id,
        "app.auth.workspace_member.id": current.id,
      };
      em.findOne.mockResolvedValue(locked);
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          const ability = new AuthAbility([
            { action: "delete", subject: Workspace },
          ]);
          RequestContext.set(User, user);
          RequestContext.set(WorkspaceMember, current);
          RequestContext.set(SELECTED_WORKSPACE, workspace);
          RequestContext.set(AuthAbility, ability);
          const update = () =>
            field === "roles"
              ? workspaceMemberService.setWorkspaceMemberRoles(current, [
                  "member",
                ])
              : workspaceMemberService.setWorkspaceMemberPermissions(
                  current,
                  [],
                );
          em.transactional.mockImplementationOnce(async (callback) => {
            await callback(em);
            throw new Error("Commit failed");
          });
          await expect(update()).rejects.toThrow("Commit failed");
          expect(RequestContext.get(WorkspaceMember)).toBe(current);
          expect(RequestContext.get(AuthAbility)).toBe(ability);
          expect(em.setSessionContext).not.toHaveBeenCalled();
          await update();
          expect(RequestContext.get(WorkspaceMember)).toBe(locked);
          expect(RequestContext.get<Workspace | null>(SELECTED_WORKSPACE)).toBe(
            workspace,
          );
          expect(
            RequestContext.get(AuthAbility)?.can("delete", Workspace),
          ).toBe(false);
          expect(em.setSessionContext).not.toHaveBeenCalled();
        },
      );
    },
  );
  it.each(["entity", "id"] as const)(
    "rejects disabling the current member by %s before writing any fields",
    async (target) => {
      const { workspaceMemberService, em } = createWorkspaceServices();
      const current = Object.assign(createTestWorkspaceMember(), {
        roles: ["owner"],
      });
      const member = Object.assign(createTestWorkspaceMember(), {
        name: "Original",
      });
      em.findOne.mockResolvedValue(member);
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          restoreAuthorization();
          RequestContext.set(User, createTestUser());
          RequestContext.set(WorkspaceMember, current);
          const workspace = createTestWorkspace();
          RequestContext.set(SELECTED_WORKSPACE, workspace);
          RequestContext.set(
            AuthAbility,
            createAuthAbility(
              {
                user: createTestUser(),
                workspace,
                member: current,
                userPermissions: [],
                workspacePermissions: ["workspace-member:write"],
              },
              withAuthTestFeatures({ workspace: { enabled: true } }),
            ),
          );
          await expect(
            workspaceMemberService.updateWorkspaceMember(
              target === "id" ? member.id : member,
              {
                status: "DISABLED",
                name: "Changed",
              },
            ),
          ).rejects.toThrow("You are not allowed to write this resource");
        },
      );
      expect(member.status).toBe("ACTIVE");
      expect(member.name).toBe("Original");
      expect(em.transactional).not.toHaveBeenCalled();
      expect(em.assign).not.toHaveBeenCalled();
      expect(em.flush).not.toHaveBeenCalled();
    },
  );
  it("still allows updating the current member's profile and disabling another member", async () => {
    const { workspaceMemberService, em } = createWorkspaceServices();
    mockRlsContext(em);
    const current = createTestWorkspaceMember();
    const other = Object.assign(createTestWorkspaceMember(), {
      id: "other-member",
    });
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      restoreAuthorization();
      RequestContext.set(User, createTestUser());
      const workspace = createTestWorkspace();
      const ability = createAuthAbility(
        {
          user: createTestUser(),
          workspace,
          member: current,
          userPermissions: [],
          workspacePermissions: ["workspace-member:write"],
        },
        withAuthTestFeatures({ workspace: { enabled: true } }),
      );
      RequestContext.set(WorkspaceMember, current);
      RequestContext.set(SELECTED_WORKSPACE, workspace);
      RequestContext.set(AuthAbility, ability);
      em.findOne.mockResolvedValue(current);
      await workspaceMemberService.updateWorkspaceMember(current, {
        name: "Updated",
      });
      expect(current.name).toBe("Updated");
      RequestContext.set(AuthAbility, ability);
      em.findOne.mockResolvedValue(other);
      await workspaceMemberService.updateWorkspaceMember(other, {
        status: "DISABLED",
      });
      expect(other.status).toBe("DISABLED");
      expect(current.status).toBe("ACTIVE");
    });
  });
  it("resolves a member ID with write permission and updates only the locked row", async () => {
    const { workspaceMemberService, em, authorization } =
      createWorkspaceServices();
    const member = Object.assign(createTestWorkspaceMember(), {
      name: "Original",
    });
    const locked = Object.assign(createTestWorkspaceMember(), {
      name: "Concurrent edit",
    });
    em.findOne.mockResolvedValueOnce(member).mockResolvedValueOnce(locked);
    vi.mocked(authorization.authorize).mockImplementation((action) => {
      if (action === "read") {
        throw new ForbiddenException();
      }
    });
    await expect(
      workspaceMemberService.updateWorkspaceMember(member.id, {
        name: " Updated ",
      }),
    ).resolves.toBe(locked);
    expect(em.findOne).toHaveBeenNthCalledWith(
      1,
      WorkspaceMember,
      { id: member.id },
      { populate: ["workspace"], refresh: true },
    );
    expect(authorization.authorize).toHaveBeenNthCalledWith(
      1,
      "write",
      WorkspaceMember,
    );
    expect(authorization.authorize).toHaveBeenNthCalledWith(2, "write", member);
    expect(authorization.authorize).toHaveBeenNthCalledWith(
      3,
      "write",
      member,
      "name",
    );
    expect(authorization.authorize).toHaveBeenNthCalledWith(4, "write", locked);
    expect(authorization.authorize).toHaveBeenNthCalledWith(
      5,
      "write",
      locked,
      "name",
    );
    expect(member.name).toBe("Original");
    expect(locked.name).toBe("Updated");
    expect(em.flush).toHaveBeenCalledOnce();
  });
  it.each(["lookup", "lock"] as const)(
    "does not change roles when a member disappears at %s",
    async (stage) => {
      const { workspaceMemberService, em } = createWorkspaceServices();
      const member = createTestWorkspaceMember();
      if (stage === "lock") {
        em.findOne.mockResolvedValueOnce(member);
      }
      em.findOne.mockResolvedValue(null);
      await expect(
        workspaceMemberService.setWorkspaceMemberRoles(member.id, ["admin"]),
      ).rejects.toThrow("Workspace member not found");
      expect(member.roles).toEqual(["member"]);
      expect(em.findOne).toHaveBeenCalledTimes(stage === "lock" ? 2 : 1);
      expect(em.flush).not.toHaveBeenCalled();
    },
  );
  it.each([false, true])(
    "rejects a missing member with context present=%s",
    async (present) => {
      const { em } = createWorkspaceServices();
      restoreAuthorization();
      const service = new WorkspaceMemberService(
        em,
        {
          workspace: { enabled: true },
        },
        createTestAuthContext(em, {
          workspace: { enabled: true },
        }),
      );
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          if (present) {
            RequestContext.set(WorkspaceMember, createTestWorkspaceMember());
          }
          await expect(
            service.leaveWorkspace(undefined as unknown as WorkspaceMember),
          ).rejects.toThrow(ForbiddenException);
        },
      );
      expect(em.transactional).not.toHaveBeenCalled();
      expect(em.remove).not.toHaveBeenCalled();
    },
  );
  it.each([false, true])(
    "clears private scope after disabling the same managed member while retaining selection (workspace key=%s)",
    async (workspaceKey) => {
      const { em, workspaceMemberService } = createWorkspaceServices();
      mockRlsContext(em);
      const workspace = createTestWorkspace();
      const user = createTestUser();
      const member = Object.assign(createTestWorkspaceMember(), {
        user: user as never,
        workspace: workspace as never,
        roles: ["owner"],
      });
      em.findOne.mockResolvedValue(member);
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(User, user);
          RequestContext.set(SELECTED_WORKSPACE, workspace);
          RequestContext.set(WorkspaceMember, member);
          if (workspaceKey) {
            RequestContext.set<ApiKeyObject | null>(
              ApiKey,
              new WorkspaceApiKey(
                Object.assign(new ApiKey(), {
                  owner: { id: member.id, unwrap: () => member },
                }),
              ),
            );
          }
          const context = createTestAuthContext(em, {
            workspace: { enabled: true },
          });
          context.initialize({});
          expect(context.authWorkspace).toBe(workspace);
          await workspaceMemberService.updateWorkspaceMember(member, {
            status: "DISABLED",
          });
          expect(context.selectedWorkspace).toBe(workspace);
          expect(context.member).toBeNull();
          expect(context.authWorkspace).toBeNull();
          expect(context.user).toBe(workspaceKey ? null : user);
          expect(context.apiKey).toBeNull();
          expect(em.setSessionContext).toHaveBeenLastCalledWith({
            role: workspaceKey ? "anonymous" : "authenticated",
            variables: {
              "app.auth.user.id": workspaceKey ? "" : user.id,
              "app.auth.workspace_member.id": "",
              "app.auth.workspace.id": "",
              "app.selected.workspace.id": workspace.id,
            },
          });
        },
      );
    },
  );
  it("allows the current member to leave without any workspace ability rules", async () => {
    const { em } = createWorkspaceServices();
    restoreAuthorization();
    const session = mockRlsContext(em);
    const workspace = createTestWorkspace();
    const member = Object.assign(createTestWorkspaceMember(), { workspace });
    const lockedWorkspaceMember = Object.assign(createTestWorkspaceMember(), {
      workspace,
    });
    const service = new WorkspaceMemberService(
      em,
      {
        workspace: { enabled: true },
      },
      createTestAuthContext(em, {
        workspace: { enabled: true },
      }),
    );
    em.findOne.mockResolvedValue(lockedWorkspaceMember);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(SELECTED_WORKSPACE, workspace);
      RequestContext.set(WorkspaceMember, member);
      const user = createTestUser();
      member.user = user as never;
      RequestContext.set(User, user);
      RequestContext.set(AuthAbility, new AuthAbility());
      expect(can("read", workspace)).toBe(false);
      await expect(service.leaveWorkspace(member)).resolves.toBe(
        lockedWorkspaceMember,
      );
      expect(RequestContext.get(WorkspaceMember)).toBeNull();
      expect(RequestContext.get<Workspace | null>(SELECTED_WORKSPACE)).toBe(
        workspace,
      );
      expect(can("delete", workspace)).toBe(false);
      expect(em.setSessionContext).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({ "app.auth.workspace.id": "" }),
        }),
      );
    });
    expect(em.findOne).toHaveBeenCalledWith(
      WorkspaceMember,
      { id: member.id, workspace },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(em.remove).toHaveBeenCalledWith(lockedWorkspaceMember);
    expect(em.flush).toHaveBeenCalledOnce();
    expect(em.fork).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(session);
  });
  it.each(["workspace", "member", "missing-member"] as const)(
    "rejects leaving with a mismatched %s identity before querying",
    async (mismatch) => {
      const { em } = createWorkspaceServices();
      restoreAuthorization();
      const workspace = createTestWorkspace();
      const member = Object.assign(createTestWorkspaceMember(), { workspace });
      const service = new WorkspaceMemberService(
        em,
        {
          workspace: { enabled: true },
        },
        createTestAuthContext(em, {
          workspace: { enabled: true },
        }),
      );
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(
            SELECTED_WORKSPACE,
            mismatch === "workspace"
              ? Object.assign(createTestWorkspace(), { id: "other-workspace" })
              : workspace,
          );
          if (mismatch !== "missing-member") {
            RequestContext.set(
              WorkspaceMember,
              mismatch === "member"
                ? Object.assign(createTestWorkspaceMember(), {
                    id: "other-member",
                  })
                : member,
            );
          }
          await expect(service.leaveWorkspace(member)).rejects.toThrow(
            ForbiddenException,
          );
        },
      );
      expect(em.findOne).not.toHaveBeenCalled();
      expect(em.remove).not.toHaveBeenCalled();
    },
  );
  it("does not bypass RLS when the departing member cannot be loaded", async () => {
    const { em } = createWorkspaceServices();
    restoreAuthorization();
    const session = mockRlsContext(em);
    const workspace = createTestWorkspace();
    const member = Object.assign(createTestWorkspaceMember(), { workspace });
    const service = new WorkspaceMemberService(
      em,
      {
        workspace: { enabled: true },
      },
      createTestAuthContext(em, {
        workspace: { enabled: true },
      }),
    );
    em.findOne.mockResolvedValue(null);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(SELECTED_WORKSPACE, workspace);
      RequestContext.set(WorkspaceMember, member);
      const user = createTestUser();
      member.user = user as never;
      RequestContext.set(User, user);
      await expect(service.leaveWorkspace(member)).rejects.toThrow(
        "Workspace member not found",
      );
    });
    expect(em.remove).not.toHaveBeenCalled();
    expect(em.fork).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(session);
  });
  it.each(["disable", "remove", "leave"] as const)(
    "allows an authorized owner to %s without a role exception",
    async (operation) => {
      const { workspaceMemberService, em } = createWorkspaceServices();
      const member = Object.assign(createTestWorkspaceMember(), {
        roles: ["owner"],
      });
      em.findOne.mockResolvedValue(member);
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          const user = createTestUser();
          member.user = user as never;
          RequestContext.set(User, user);
          const result =
            operation === "disable"
              ? workspaceMemberService.updateWorkspaceMember(member, {
                  status: "DISABLED",
                })
              : operation === "remove"
                ? workspaceMemberService.removeWorkspaceMember(member)
                : workspaceMemberService.leaveWorkspace(member);
          await expect(result).resolves.toBe(member);
        },
      );
      expect(em.flush).toHaveBeenCalledOnce();
    },
  );
  it("loads member users with Service checks and the injected RLS manager", async () => {
    const { workspaceMemberService, em, authorization } =
      createWorkspaceServices();
    const session = mockRlsContext(em);
    const user = Object.assign(createTestUser(), { id: "user-1" });
    const member = Object.assign(createTestWorkspaceMember(), {
      user: { id: user.id, loadOrFail: vi.fn() },
    });
    em.findOne.mockResolvedValueOnce(member).mockResolvedValueOnce(user);
    await expect(
      workspaceMemberService.getWorkspaceMemberUser(member),
    ).resolves.toBe(user);
    expect(authorization.assertCurrentWorkspace).toHaveBeenCalledWith(
      member.workspace,
    );
    expect(authorization.authorize).toHaveBeenCalledWith("read", User);
    expect(em.findOne).toHaveBeenLastCalledWith(
      User,
      { id: user.id },
      { refresh: true },
    );
    expect(member.user.loadOrFail).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(session);
    expect(em.fork).not.toHaveBeenCalled();
    vi.mocked(authorization.authorize).mockImplementation(() => {
      throw new ForbiddenException();
    });
    em.findOne.mockClear();
    await expect(
      workspaceMemberService.getWorkspaceMemberUser(member),
    ).rejects.toThrow(ForbiddenException);
    expect(em.findOne).not.toHaveBeenCalled();
  });
  it("reads the browser user's own member association without selecting a workspace", async () => {
    const { workspaceMemberService, em, authorization } =
      createWorkspaceServices();
    const user = Object.assign(createTestUser(), { id: "self" });
    const member = Object.assign(createTestWorkspaceMember(), {
      user: { id: user.id },
    });
    em.findOne.mockResolvedValueOnce(member).mockResolvedValueOnce(user);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(User, user);
      await expect(
        workspaceMemberService.getWorkspaceMemberUser(member),
      ).resolves.toBe(user);
      expect(em.findOne).toHaveBeenCalledWith(
        WorkspaceMember,
        { id: member.id, workspace: member.workspace, user: user.id },
        { refresh: true },
      );
      expect(authorization.assertCurrentWorkspace).not.toHaveBeenCalled();
      expect(authorization.authorize).not.toHaveBeenCalled();
      RequestContext.set<ApiKeyObject | null>(
        ApiKey,
        new WorkspaceApiKey(new ApiKey()),
      );
      RequestContext.set(
        User,
        Object.assign(createTestUser(), { id: "other" }),
      );
      vi.mocked(authorization.assertCurrentWorkspace).mockImplementation(() => {
        throw new ForbiddenException();
      });
      await expect(
        workspaceMemberService.getWorkspaceMemberUser(member),
      ).rejects.toThrow(ForbiddenException);
    });
  });
  it("returns null for absent member users and rows hidden by RLS", async () => {
    const { workspaceMemberService, em } = createWorkspaceServices();
    const member = createTestWorkspaceMember();
    em.findOne.mockResolvedValueOnce(member).mockResolvedValueOnce(null);
    await expect(
      workspaceMemberService.getWorkspaceMemberUser(member),
    ).resolves.toBeNull();
    await expect(
      workspaceMemberService.getWorkspaceMemberUser(member),
    ).resolves.toBeNull();
    expect(em.findOne).toHaveBeenCalledTimes(2);
  });
  it("reads members with the scoped manager", async () => {
    const { workspaceMemberService, em } = createWorkspaceServices();
    const context = mockRlsContext(em);
    em.findOne.mockResolvedValue(null);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(SELECTED_WORKSPACE, createTestWorkspace());
      await expect(
        workspaceMemberService.getWorkspaceMember("hidden"),
      ).resolves.toBeNull();
    });
    expect(em.fork).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(context);
  });
  it("authorizes member pagination before returning the selected workspace filter", () => {
    const { workspaceMemberService, authorization, em } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    expect(
      workspaceMemberService.getWorkspaceMemberListFilter(workspace),
    ).toEqual({
      workspace,
    });
    expect(authorization.assertCurrentWorkspace).toHaveBeenCalledWith(
      workspace,
    );
    expect(authorization.authorize).toHaveBeenCalledWith(
      "read",
      WorkspaceMember,
    );
    vi.mocked(authorization.authorize).mockImplementation(() => {
      throw new ForbiddenException();
    });
    expect(() =>
      workspaceMemberService.getWorkspaceMemberListFilter(workspace),
    ).toThrow(ForbiddenException);
    expect(em.find).not.toHaveBeenCalled();
  });
  it("rejects member reads without a request context before querying", async () => {
    const { workspaceMemberService, em } = createWorkspaceServices();
    await expect(
      workspaceMemberService.getWorkspaceMember("member-1"),
    ).rejects.toThrow(ForbiddenException);
    expect(em.findOne).not.toHaveBeenCalled();
  });
  it("rejects member reads without a selected workspace before querying", async () => {
    const { workspaceMemberService, em } = createWorkspaceServices();
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      await expect(
        workspaceMemberService.getWorkspaceMember("member-1"),
      ).rejects.toThrow(ForbiddenException);
    });
    expect(em.findOne).not.toHaveBeenCalled();
  });
  it("checks workspace read ability before querying a member", async () => {
    const { workspaceMemberService, em, authorization } =
      createWorkspaceServices();
    vi.mocked(authorization.authorize).mockImplementation(() => {
      throw new ForbiddenException();
    });
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(SELECTED_WORKSPACE, createTestWorkspace());
      await expect(
        workspaceMemberService.getWorkspaceMember("member-1"),
      ).rejects.toThrow(ForbiddenException);
    });
    expect(em.findOne).not.toHaveBeenCalled();
  });
  it("does not reuse a previous request's workspace for member reads", async () => {
    const { workspaceMemberService, em } = createWorkspaceServices();
    for (const id of ["workspace-1", "workspace-2"]) {
      const workspace = Object.assign(createTestWorkspace(), { id });
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(SELECTED_WORKSPACE, workspace);
          await workspaceMemberService.getWorkspaceMember("member-1");
          expect(em.findOne).toHaveBeenLastCalledWith(WorkspaceMember, {
            id: "member-1",
            workspace,
          });
        },
      );
    }
  });
  it("enforces self-removal rules without a resolver", async () => {
    const { workspaceMemberService, em } = createWorkspaceServices();
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const actor = Object.assign(createTestWorkspaceMember(), {
        id: "actor",
        roles: ["admin"],
      });
      RequestContext.set(WorkspaceMember, actor);
      await expect(
        workspaceMemberService.removeWorkspaceMember(actor),
      ).rejects.toThrow("You are not allowed to remove yourself");
      expect(em.flush).not.toHaveBeenCalled();
    });
  });
  it("assigns and replaces the configured creator role through ordinary role updates", async () => {
    const { workspaceMemberService, em } = createWorkspaceServices({
      creatorRole: "founder",
      roles: { founder: [], owner: [], member: [] },
    });
    const target = createTestWorkspaceMember();
    em.findOne.mockResolvedValue(target);
    await expect(
      workspaceMemberService.setWorkspaceMemberRoles(target, ["founder"]),
    ).resolves.toBe(target);
    expect(target.roles).toEqual(["founder"]);
    await expect(
      workspaceMemberService.setWorkspaceMemberRoles(target, ["owner"]),
    ).resolves.toBe(target);
    expect(target.roles).toEqual(["owner"]);
  });
  it("does not require the configured creator role for direct permission changes", async () => {
    const { workspaceMemberService, em } = createWorkspaceServices({
      creatorRole: "founder",
    });
    const target = createTestWorkspaceMember();
    em.findOne.mockResolvedValue(target);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(
        WorkspaceMember,
        Object.assign(createTestWorkspaceMember(), {
          id: "actor",
          roles: ["admin"],
        }),
      );
      await expect(
        workspaceMemberService.setWorkspaceMemberPermissions(target, []),
      ).resolves.toBe(target);
    });
  });
  it("cancels pending invitations in the same transaction when adding a member", async () => {
    const { em, workspaceMemberService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = Object.assign(createTestUser(), {
      email: "ALICE@example.com",
      name: "Alice",
    });
    await workspaceMemberService.addWorkspaceMember(workspace, user);
    expect(em.transactional).toHaveBeenCalledTimes(1);
    expect(em.refreshOrFail).toHaveBeenCalledWith(
      workspace,
      expect.objectContaining({
        filters: false,
        lockMode: LockMode.PESSIMISTIC_WRITE,
      }),
    );
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      WorkspaceInvitation,
      { workspace, email: "alice@example.com", status: "pending" },
      { status: "canceled" },
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("adds a member by normalized email inside the workspace permission boundary", async () => {
    const { authorization, em, workspaceMemberService } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = Object.assign(createTestUser(), {
      email: "alice@example.com",
      name: "Alice",
    });
    em.findOne.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    await expect(
      workspaceMemberService.addWorkspaceMemberByEmail(
        workspace,
        " Alice@Example.com ",
      ),
    ).resolves.toEqual(expect.objectContaining({ user, workspace }));
    expect(em.findOne).toHaveBeenNthCalledWith(
      1,
      User,
      { email: "alice@example.com" },
      { filters: false },
    );
    expect(authorization.authorize).toHaveBeenCalledWith(
      "write",
      expect.objectContaining({
        workspaceId: workspace.id,
        type: WorkspaceMemberType.USER,
      }),
    );
  });
  it("rejects workspace resources outside the selected request context", async () => {
    const { authorization, em, workspaceMemberService } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    vi.mocked(authorization.assertCurrentWorkspace).mockImplementation(() => {
      throw new ForbiddenException();
    });
    await expect(
      workspaceMemberService.getWorkspaceMemberConnectionByWorkspace(
        workspace,
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.find).not.toHaveBeenCalled();
  });
  it("adds and updates a workspace member", async () => {
    const { em, workspaceMemberService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = Object.assign(createTestUser(), {
      email: "bob@example.com",
      name: "Bob",
    });
    em.findOne.mockResolvedValue(null);
    const member = await workspaceMemberService.addWorkspaceMember(
      workspace,
      user,
      {
        permissions: ["workspace:update"],
        roles: ["admin"],
      },
    );
    expect(member).toEqual(
      expect.objectContaining({
        permissions: ["workspace:update"],
        roles: ["admin"],
        user,
        workspace,
      }),
    );
    em.findOne.mockResolvedValue(member);
    await expect(
      workspaceMemberService.updateWorkspaceMember(member, {
        status: "DISABLED",
      }),
    ).resolves.toBe(member);
    expect(member.user).toBe(user);
    expect(member.name).toBe("Bob");
    expect(member.email).toBe("bob@example.com");
    expect(member.status).toBe("DISABLED");
    await expect(
      workspaceMemberService.updateWorkspaceMember(member, {
        roles: ["member"],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it("rejects duplicate members and missing users", async () => {
    const { em, workspaceMemberService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = Object.assign(createTestUser(), {
      email: "alice@example.com",
    });
    const member = Object.assign(createTestWorkspaceMember(), {
      user,
      workspace,
    });
    em.findOne.mockResolvedValueOnce(member);
    await expect(
      workspaceMemberService.addWorkspaceMember(workspace, user),
    ).rejects.toThrow("User is already a member");
    em.findOne.mockReset();
    em.findOne.mockResolvedValueOnce(null);
    await expect(
      workspaceMemberService.addWorkspaceMemberByEmail(
        workspace,
        "missing@example.com",
      ),
    ).rejects.toThrow("User not found");
  });
  it("allows editing owner contact fields through update ability without an owner caller", async () => {
    const { workspaceMemberService, em, authorization } =
      createWorkspaceServices();
    const owner = Object.assign(createTestWorkspaceMember(), {
      roles: ["owner"],
    });
    em.findOne.mockResolvedValue(owner);
    await expect(
      workspaceMemberService.updateWorkspaceMember(owner, {
        name: "Shared owner name",
        email: "shared@example.com",
      }),
    ).resolves.toBe(owner);
    expect(authorization.authorize).toHaveBeenLastCalledWith(
      "write",
      owner,
      "email",
    );
    expect(authorization.assertCurrentWorkspaceMember).not.toHaveBeenCalled();
    expect(owner.roles).toEqual(["owner"]);
    expect(owner.name).toBe("Shared owner name");
    expect(em.flush).toHaveBeenCalledOnce();
  });
  it("does not edit owner contact fields without update ability", async () => {
    const { workspaceMemberService, em, authorization } =
      createWorkspaceServices();
    vi.mocked(authorization.authorize).mockImplementation(() => {
      throw new ForbiddenException();
    });
    await expect(
      workspaceMemberService.updateWorkspaceMember(
        Object.assign(createTestWorkspaceMember(), { roles: ["owner"] }),
        { name: "Denied" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.assign).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });
  it("rechecks update ability under a row lock before disabling a member", async () => {
    const { em, workspaceMemberService, authorization } =
      createWorkspaceServices();
    vi.spyOn(
      workspaceMemberService,
      "getCurrentWorkspaceMember",
    ).mockReturnValue(
      Object.assign(createTestWorkspaceMember(), {
        id: "actor",
        roles: ["owner"],
      }),
    );
    const workspace = createTestWorkspace();
    const staleWorkspaceMember = Object.assign(createTestWorkspaceMember(), {
      roles: ["member"],
      workspace,
    });
    const promotedWorkspaceMember = Object.assign(createTestWorkspaceMember(), {
      id: staleWorkspaceMember.id,
      roles: ["owner"],
      workspace,
    });
    em.findOne.mockResolvedValue(promotedWorkspaceMember);
    vi.mocked(authorization.authorize).mockImplementation(
      (_action, subject, field) => {
        if (subject === promotedWorkspaceMember && field === "status") {
          throw new ForbiddenException();
        }
      },
    );
    await expect(
      workspaceMemberService.updateWorkspaceMember(staleWorkspaceMember, {
        status: "DISABLED",
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(em.transactional).toHaveBeenCalledTimes(1);
    expect(em.findOne).toHaveBeenCalledWith(
      WorkspaceMember,
      { id: staleWorkspaceMember.id, workspace },
      {
        lockMode: LockMode.PESSIMISTIC_WRITE,
        refresh: true,
      },
    );
    expect(promotedWorkspaceMember.status).toBe("ACTIVE");
    expect(em.assign).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });
  it("rejects updates when the member was removed before acquiring its lock", async () => {
    const { em, workspaceMemberService } = createWorkspaceServices();
    em.findOne.mockResolvedValue(null);
    await expect(
      workspaceMemberService.updateWorkspaceMember(
        createTestWorkspaceMember(),
        {
          status: "DISABLED",
        },
      ),
    ).rejects.toThrow("Workspace member not found");
    expect(em.assign).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });
  it("preserves omitted member fields when updating status through a DTO", async () => {
    const { em, workspaceMemberService } = createWorkspaceServices();
    const member = Object.assign(createTestWorkspaceMember(), {
      roles: ["admin"],
      permissions: ["workspace:update"],
    });
    em.findOne.mockResolvedValue(member);
    await workspaceMemberService.updateWorkspaceMember(member, {
      status: "DISABLED",
    });
    expect(member.status).toBe("DISABLED");
    expect(member.roles).toEqual(["admin"]);
    expect(member.permissions).toEqual(["workspace:update"]);
    expect(em.assign).toHaveBeenCalledWith(member, { status: "DISABLED" });
  });
  it("edits shared member fields without changing private user fields", async () => {
    const { em, workspaceMemberService } = createWorkspaceServices();
    const user = Object.assign(createTestUser(), {
      name: "Private name",
      email: "private@example.com",
    });
    const member = Object.assign(createTestWorkspaceMember(), {
      user,
      name: "Old name",
      email: "old@example.com",
    });
    em.findOne.mockResolvedValue(member);
    await workspaceMemberService.updateWorkspaceMember(member, {
      name: " Shared name ",
      email: " Shared@Example.COM ",
    });
    expect(member.name).toBe("Shared name");
    expect(member.email).toBe("shared@example.com");
    expect(user.name).toBe("Private name");
    expect(user.email).toBe("private@example.com");
    expect(em.assign).toHaveBeenCalledWith(member, {
      name: "Shared name",
      email: "shared@example.com",
    });
    em.findOne.mockResolvedValue(member);
    await workspaceMemberService.updateWorkspaceMember(member, {
      email: null,
      name: undefined,
    });
    expect(member.email).toBeNull();
    expect(member.name).toBe("Shared name");
    expect(user.email).toBe("private@example.com");
    expect(em.assign).toHaveBeenLastCalledWith(member, { email: null });
  });
  it.each(["", "  ", null])(
    "rejects invalid shared member name %s before persistence",
    async (name) => {
      const { em, workspaceMemberService } = createWorkspaceServices();
      await expect(
        workspaceMemberService.updateWorkspaceMember(
          createTestWorkspaceMember(),
          {
            name,
          } as never,
        ),
      ).rejects.toThrow("WorkspaceMember name must not be empty");
      expect(em.assign).not.toHaveBeenCalled();
      expect(em.flush).not.toHaveBeenCalled();
    },
  );
  it("preserves distinct configured case variants in direct member permissions", async () => {
    const permissions = ["Project:READ", "project:read"];
    const { em, workspaceMemberService } = createWorkspaceServices({
      permissions,
    });
    const member = createTestWorkspaceMember();
    em.findOne.mockResolvedValue(member);
    await workspaceMemberService.setWorkspaceMemberPermissions(
      member,
      permissions,
    );
    expect(member.permissions).toEqual(permissions);
    await expect(
      workspaceMemberService.setWorkspaceMemberPermissions(member, [
        "project:READ",
      ]),
    ).rejects.toThrow("contains unknown permissions: project:READ");
  });
  it("allows shared contact emails without querying for duplicates", async () => {
    const { em, workspaceMemberService } = createWorkspaceServices();
    const member = Object.assign(createTestWorkspaceMember(), {
      email: "old@example.com",
    });
    em.findOne
      .mockResolvedValueOnce(member)
      .mockResolvedValueOnce(createTestWorkspaceMember());
    await expect(
      workspaceMemberService.updateWorkspaceMember(member, {
        email: "occupied@example.com",
      }),
    ).resolves.toBe(member);
    expect(member.email).toBe("occupied@example.com");
    expect(em.findOne).toHaveBeenCalledTimes(1);
    expect(em.assign).toHaveBeenCalledWith(member, {
      email: "occupied@example.com",
    });
    expect(em.flush).toHaveBeenCalledOnce();
  });
  it("authorizes the exact membership email lookup before accessing private users", async () => {
    const { em, workspaceMemberService, authorization } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = createTestUser();
    em.findOne.mockResolvedValue(user);
    await expect(
      workspaceMemberService.getUserForWorkspaceMembership(
        workspace,
        " Person@Example.COM ",
      ),
    ).resolves.toBe(user);
    expect(em.findOne).toHaveBeenCalledWith(
      User,
      { email: "person@example.com" },
      { filters: false },
    );
    em.findOne.mockClear();
    vi.mocked(authorization.authorize).mockImplementation(() => {
      throw new ForbiddenException();
    });
    await expect(
      workspaceMemberService.getUserForWorkspaceMembership(
        workspace,
        "person@example.com",
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(em.findOne).not.toHaveBeenCalled();
  });
  it("validates direct member permissions against the workspace catalog", async () => {
    const { authorization, em, workspaceMemberService } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = createTestUser();
    em.findOne.mockResolvedValue(null);
    await expect(
      workspaceMemberService.addWorkspaceMember(workspace, user, {
        permissions: ["user:read"],
      }),
    ).rejects.toThrow(
      "Workspace member contains unknown permissions: user:read",
    );
    const member = createTestWorkspaceMember();
    await expect(
      workspaceMemberService.setWorkspaceMemberPermissions(member, [
        "workspace:update",
        "workspace:update",
      ]),
    ).rejects.toThrow(
      "Workspace member contains duplicate permissions: workspace:update",
    );
    em.findOne.mockResolvedValue(member);
    await expect(
      workspaceMemberService.setWorkspaceMemberPermissions(member, [
        "workspace:update",
      ]),
    ).resolves.toBe(member);
    expect(member.permissions).toEqual(["workspace:update"]);
    expect(authorization.assertCanGrantPermissions).toHaveBeenCalledWith(
      expect.anything(),
      "workspace",
      ["workspace:update"],
    );
  });
  it("reloads detached members in the auth transaction before persisting permissions", async () => {
    const { authorization, em, workspaceMemberService } =
      createWorkspaceServices();
    mockRlsContext(em);
    const detached = Object.assign(createTestWorkspaceMember(), {
      status: "DISABLED",
      roles: ["owner"],
    });
    const managed = createTestWorkspaceMember();
    em.findOne.mockResolvedValue(managed);
    await expect(
      workspaceMemberService.setWorkspaceMemberPermissions(detached, [
        "workspace:update",
      ]),
    ).resolves.toBe(managed);
    expect(em.fork).not.toHaveBeenCalled();
    expect(em.transactional).toHaveBeenCalledOnce();
    expect(em.findOne).toHaveBeenCalledWith(
      WorkspaceMember,
      { id: detached.id, workspace: detached.workspace },
      { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
    );
    expect(authorization.authorize).toHaveBeenLastCalledWith(
      "set-permissions",
      managed,
    );
    expect(managed.permissions).toEqual(["workspace:update"]);
    expect(managed.status).toBe("ACTIVE");
    expect(managed.roles).toEqual(["member"]);
    expect(detached.permissions).toEqual([]);
    expect(em.persist).not.toHaveBeenCalled();
    expect(em.flush).toHaveBeenCalledOnce();
  });
  it("does not recreate a deleted member while setting permissions", async () => {
    const { em, workspaceMemberService } = createWorkspaceServices();
    em.findOne.mockResolvedValue(null);
    await expect(
      workspaceMemberService.setWorkspaceMemberPermissions(
        createTestWorkspaceMember(),
        ["workspace:update"],
      ),
    ).rejects.toThrow("Workspace member not found");
    expect(em.flush).not.toHaveBeenCalled();
  });
  it("rechecks permission access against the locked member", async () => {
    const { authorization, em, workspaceMemberService } =
      createWorkspaceServices();
    const detached = createTestWorkspaceMember();
    const managed = createTestWorkspaceMember();
    em.findOne.mockResolvedValue(managed);
    vi.mocked(authorization.authorize).mockImplementation(
      (_action, subject) => {
        if (subject === managed) {
          throw new ForbiddenException();
        }
      },
    );
    await expect(
      workspaceMemberService.setWorkspaceMemberPermissions(detached, [
        "workspace:update",
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(managed.permissions).toEqual([]);
    expect(em.flush).not.toHaveBeenCalled();
  });
  it("checks role grants against the issuer permission ceiling", async () => {
    const { authorization, em, workspaceMemberService } =
      createWorkspaceServices();
    const member = Object.assign(createTestWorkspaceMember(), {
      roles: ["member"],
    });
    em.findOne.mockResolvedValue(member);
    await workspaceMemberService.setWorkspaceMemberRoles(member, ["admin"]);
    expect(authorization.assertCanGrantPermissions).toHaveBeenCalledWith(
      expect.anything(),
      "workspace",
      expect.arrayContaining(["workspace:update", "workspace-member:write"]),
    );
  });
  it("lists configured roles and updates member roles", async () => {
    const { em, workspaceMemberService } = createWorkspaceServices({
      permissions: [
        "workspace:update",
        "workspace-member:write",
        "workspace:delete",
        "workspace-member:invite",
      ],
      roles: {
        admin: ["workspace:update", "workspace-member:write"],
        member: [],
        owner: ["workspace:delete"],
      },
    });
    const member = Object.assign(createTestWorkspaceMember(), {
      permissions: ["workspace-member:invite"],
      roles: ["member"],
    });
    em.findOne.mockResolvedValue(member);
    expect(workspaceMemberService.listRoles()).toEqual([
      { role: "owner", grantable: true },
      { role: "admin", grantable: true },
      { role: "member", grantable: true },
    ]);
    expect(workspaceMemberService.listPermissions()).toEqual(
      DEFAULT_WORKSPACE_PERMISSIONS.map((permission) => ({
        permission,
        grantable: true,
      })),
    );
    await expect(
      workspaceMemberService.setWorkspaceMemberRoles(member, ["admin"]),
    ).resolves.toBe(member);
    expect(member.roles).toEqual(["admin"]);
    expect(
      workspaceMemberService.getEffectiveWorkspaceMemberPermissions(member),
    ).toEqual(DEFAULT_WORKSPACE_ROLES.admin);
    await expect(
      workspaceMemberService.setWorkspaceMemberRoles(member, ["missing"]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      workspaceMemberService.setWorkspaceMemberRoles(member, ["owner"]),
    ).resolves.toBe(member);
    expect(member.roles).toEqual(["owner"]);
  });
  it("rechecks update ability on the locked member before changing owner roles", async () => {
    const { em, workspaceMemberService, authorization } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    const staleWorkspaceMember = Object.assign(createTestWorkspaceMember(), {
      roles: ["member"],
      workspace,
    });
    const promotedWorkspaceMember = Object.assign(createTestWorkspaceMember(), {
      id: staleWorkspaceMember.id,
      roles: ["owner"],
      workspace,
    });
    em.findOne.mockResolvedValue(promotedWorkspaceMember);
    vi.mocked(authorization.authorize).mockImplementation(
      (_action, subject) => {
        if (subject === promotedWorkspaceMember) {
          throw new ForbiddenException();
        }
      },
    );
    await expect(
      workspaceMemberService.setWorkspaceMemberRoles(staleWorkspaceMember, [
        "admin",
      ]),
    ).rejects.toThrow(ForbiddenException);
    expect(em.findOne).toHaveBeenCalledWith(
      WorkspaceMember,
      { id: staleWorkspaceMember.id, workspace },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(promotedWorkspaceMember.roles).toEqual(["owner"]);
    expect(em.flush).not.toHaveBeenCalled();
  });
  it("rejects owner role grants beyond the caller's permission scope", async () => {
    const { em, workspaceMemberService, authorization } =
      createWorkspaceServices();
    const member = createTestWorkspaceMember();
    vi.mocked(authorization.assertCanGrantPermissions).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );
    await expect(
      workspaceMemberService.setWorkspaceMemberRoles(member, ["owner"]),
    ).rejects.toThrow(ForbiddenException);
    expect(authorization.assertCanGrantPermissions).toHaveBeenCalledWith(
      expect.anything(),
      "workspace",
      expect.arrayContaining(["workspace:delete"]),
    );
    expect(em.transactional).not.toHaveBeenCalled();
    expect(member.roles).toEqual(["member"]);
  });
  it("finds members by identifier only in the request's selected workspace", async () => {
    const { em, workspaceMemberService, authorization } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    const member = createTestWorkspaceMember();
    em.findOne.mockResolvedValue(member);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(SELECTED_WORKSPACE, workspace);
      await expect(
        workspaceMemberService.getWorkspaceMember(member.id),
      ).resolves.toBe(member);
    });
    expect(authorization.assertCurrentWorkspace).toHaveBeenCalledWith(
      workspace,
    );
    expect(authorization.authorize).toHaveBeenCalledWith(
      "read",
      WorkspaceMember,
    );
    expect(em.findOne).toHaveBeenCalledWith(WorkspaceMember, {
      id: member.id,
      workspace,
    });
  });
  it("rechecks delete ability and current identity under a row lock before removal", async () => {
    const { em, workspaceMemberService, authorization } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    const staleWorkspaceMember = Object.assign(createTestWorkspaceMember(), {
      roles: ["member"],
      workspace,
    });
    const promotedWorkspaceMember = Object.assign(createTestWorkspaceMember(), {
      id: staleWorkspaceMember.id,
      roles: ["owner"],
      workspace,
    });
    em.findOne.mockResolvedValue(promotedWorkspaceMember);
    vi.mocked(authorization.authorize).mockImplementation(
      (_action, subject) => {
        if (subject === promotedWorkspaceMember) {
          throw new ForbiddenException();
        }
      },
    );
    vi.mocked(authorization.assertCurrentWorkspaceMember).mockImplementation(
      (member) => {
        if (member === promotedWorkspaceMember) {
          throw new ForbiddenException();
        }
      },
    );
    await expect(
      workspaceMemberService.removeWorkspaceMember(staleWorkspaceMember),
    ).rejects.toThrow(ForbiddenException);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const user = createTestUser();
      staleWorkspaceMember.user = user as never;
      RequestContext.set(User, user);
      await expect(
        workspaceMemberService.leaveWorkspace(staleWorkspaceMember),
      ).rejects.toThrow(ForbiddenException);
    });
    expect(em.findOne).toHaveBeenCalledWith(
      WorkspaceMember,
      { id: staleWorkspaceMember.id, workspace },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(em.remove).not.toHaveBeenCalled();
  });
  it("removes a member only after reloading it under a row lock", async () => {
    const { em, workspaceMemberService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const member = Object.assign(createTestWorkspaceMember(), {
      roles: ["member"],
      workspace,
    });
    em.findOne.mockResolvedValue(member);
    await expect(
      workspaceMemberService.removeWorkspaceMember(member),
    ).resolves.toBe(member);
    expect(em.remove).toHaveBeenCalledWith(member);
  });
  it("checks flattened member permissions regardless of role", () => {
    const { workspaceMemberService } = createWorkspaceServices();
    const owner = Object.assign(createTestWorkspaceMember(), {
      permissions: ["project:read", "project:update"],
      roles: ["owner"],
    });
    expect(
      workspaceMemberService.hasPermissions(owner, {
        permissions: { project: ["read", "update"] },
      }),
    ).toBe(true);
    expect(
      workspaceMemberService.hasPermissions(owner, {
        permissions: { project: ["delete"] },
      }),
    ).toBe(false);
  });

  it("rejects an externally owned transaction before deleting the membership", async () => {
    const { em } = createWorkspaceServices();
    restoreAuthorization();
    em.isInTransaction.mockReturnValue(true);
    const workspace = createTestWorkspace();
    const member = Object.assign(createTestWorkspaceMember(), { workspace });
    const service = new WorkspaceMemberService(
      em,
      { workspace: { enabled: true } },
      createTestAuthContext(em, { workspace: { enabled: true } }),
    );
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(SELECTED_WORKSPACE, workspace);
      RequestContext.set(WorkspaceMember, member);
      const user = createTestUser();
      member.user = user as never;
      RequestContext.set(User, user);
      await expect(service.leaveWorkspace(member)).rejects.toThrow(
        "outside an active transaction",
      );
      expect(RequestContext.get(WorkspaceMember)).toBe(member);
    });
    expect(em.transactional).not.toHaveBeenCalled();
    expect(em.remove).not.toHaveBeenCalled();
  });
});

describe("permission management", () => {
  describe("WorkspaceMemberService direct permission authorization", () => {
    const permissions = [
      "workspace-member:write",
      "workspace:update",
      "workspace:delete",
    ];
    const options = {
      workspace: {
        enabled: true,
        permissions,
        creatorRole: "founder",
        roles: {
          founder: permissions,
          admin: ["workspace-member:write", "workspace:update"],
          custom: [],
        },
      },
    };

    it.each([
      {
        role: "admin",
        direct: [],
        key: undefined,
        expected: ["admin", "member", "custom"],
      },
      {
        role: "custom",
        direct: permissions,
        key: undefined,
        expected: ["founder", "custom"],
      },
      {
        role: "founder",
        direct: [],
        key: "user",
        expected: ["custom"],
      },
      {
        role: "founder",
        direct: [],
        key: "workspace",
        expected: ["custom"],
      },
    ])(
      "lists grantable roles for $role with key=$key",
      async ({ role, direct, key, expected }) => {
        const { em } = createWorkspaceServices();
        restoreAuthorization();
        const service = new WorkspaceMemberService(
          em,
          options,
          createTestAuthContext(em, options),
        );
        const workspace = createTestWorkspace();
        await RequestContext.run(new RequestContext({ type: "test" }), () => {
          const user = createTestUser();
          RequestContext.set(User, user);
          RequestContext.set(SELECTED_WORKSPACE, workspace);
          if (key !== "workspace") {
            RequestContext.set(
              WorkspaceMember,
              Object.assign(createTestWorkspaceMember(), {
                user: ref(User, user),
                roles: [role],
                permissions: direct,
              }),
            );
          }
          if (key) {
            RequestContext.set<ApiKeyObject | null>(
              ApiKey,
              Object.assign(
                key === "user"
                  ? new UserApiKey(new ApiKey())
                  : new WorkspaceApiKey(new ApiKey()),
                {
                  user: key === "user" ? ref(User, user) : null,
                  permissions:
                    key === "user"
                      ? ["workspace-member:write"]
                      : ["workspace-member:write", "workspace:update"],
                },
              ),
            );
          }
          RequestContext.set(
            AuthAbility,
            new AuthAbility([
              { action: "write", subject: WorkspaceInvitation },
            ]),
          );
          expect(service.listRoles()).toEqual(
            ["owner", "admin", "member", "founder", "custom"].map((role) => ({
              role,
              grantable: expected.includes(role),
            })),
          );
          for (const { role } of service
            .listRoles()
            .filter(({ grantable }) => grantable)) {
            const grants =
              role in DEFAULT_WORKSPACE_ROLES
                ? DEFAULT_WORKSPACE_ROLES[
                    role as keyof typeof DEFAULT_WORKSPACE_ROLES
                  ]
                : options.workspace.roles[
                    role as keyof typeof options.workspace.roles
                  ];
            expect(() => {
              assertCanGrantPermissions(
                withAuthTestFeatures(options),
                "workspace",
                grants,
              );
            }).not.toThrow();
          }
          RequestContext.set(AuthAbility, new AuthAbility());
          expect(() => service.listRoles()).toThrow(ForbiddenException);
          RequestContext.set(
            AuthAbility,
            new AuthAbility([{ action: "read", subject: WorkspaceMember }]),
          );
          expect(service.listRoles().every(({ grantable }) => !grantable)).toBe(
            true,
          );
          expect(service.listPermissions()).toEqual(
            DEFAULT_WORKSPACE_PERMISSIONS.map((permission) => ({
              permission,
              grantable: false,
            })),
          );
          RequestContext.set(
            AuthAbility,
            new AuthAbility([
              { action: "set-permissions", subject: WorkspaceMember },
            ]),
          );
          expect(service.listPermissions()).toEqual(
            DEFAULT_WORKSPACE_PERMISSIONS.map((permission) => ({
              permission,
              grantable: canGrantPermissions(
                withAuthTestFeatures(options),
                "workspace",
                [permission],
              ),
            })),
          );
        });
      },
    );

    it.each([
      {
        name: "administrator",
        role: "admin",
        canUpdate: true,
        grant: "workspace:update",
        allowed: true,
      },
      {
        name: "custom role with direct grants",
        role: "custom",
        canUpdate: true,
        grant: "workspace:update",
        allowed: true,
      },
      {
        name: "creator without update ability",
        role: "founder",
        canUpdate: false,
        grant: "workspace:update",
        allowed: false,
      },
      {
        name: "administrator exceeding the grant ceiling",
        role: "admin",
        canUpdate: true,
        grant: "workspace:delete",
        allowed: false,
      },
      {
        name: "personal API key with narrower grants",
        role: "admin",
        canUpdate: true,
        grant: "workspace:update",
        key: "user",
        allowed: false,
      },
      {
        name: "member API key within its grants",
        role: "admin",
        canUpdate: true,
        grant: "workspace:update",
        key: "workspace",
        allowed: true,
      },
      {
        name: "member API key exceeding its grants",
        role: "admin",
        canUpdate: true,
        grant: "workspace:delete",
        key: "workspace",
        allowed: false,
      },
    ])(
      "checks $name using ability and the credential grant ceiling",
      async (scenario) => {
        const { em } = createWorkspaceServices();
        restoreAuthorization();
        const service = new WorkspaceMemberService(
          em,
          options,
          createTestAuthContext(em, options),
        );
        const workspace = createTestWorkspace();
        const target = Object.assign(createTestWorkspaceMember(), {
          workspace: ref(Workspace, workspace),
        });
        em.findOne.mockResolvedValue(target);
        const user = createTestUser();
        const actor = Object.assign(createTestWorkspaceMember(), {
          id: "actor",
          user: ref(User, user),
          workspace: ref(Workspace, workspace),
          roles: [scenario.role],
          permissions:
            scenario.role === "custom"
              ? ["workspace-member:write", "workspace:update"]
              : [],
        });

        await RequestContext.run(
          new RequestContext({ type: "test" }),
          async () => {
            RequestContext.set(User, user);
            RequestContext.set(SELECTED_WORKSPACE, workspace);
            RequestContext.set(WorkspaceMember, actor);
            if (scenario.key) {
              RequestContext.set<ApiKeyObject | null>(
                ApiKey,
                Object.assign(
                  scenario.key === "user"
                    ? new UserApiKey(new ApiKey())
                    : new WorkspaceApiKey(new ApiKey()),
                  {
                    user: scenario.key === "user" ? ref(User, user) : null,
                    member:
                      scenario.key === "workspace"
                        ? ref(WorkspaceMember, actor)
                        : null,
                    permissions:
                      scenario.key === "workspace"
                        ? ["workspace-member:write", "workspace:update"]
                        : ["workspace-member:write"],
                  },
                ),
              );
            }
            RequestContext.set(
              AuthAbility,
              new AuthAbility(
                scenario.canUpdate
                  ? [{ action: "set-permissions", subject: WorkspaceMember }]
                  : [],
              ),
            );
            const operation = service.setWorkspaceMemberPermissions(target, [
              scenario.grant,
            ]);
            if (scenario.allowed) {
              await expect(operation).resolves.toBe(target);
              expect(target.permissions).toEqual([scenario.grant]);
              expect(em.flush).toHaveBeenCalledOnce();
            } else {
              await expect(operation).rejects.toBeInstanceOf(
                ForbiddenException,
              );
              expect(target.permissions).toEqual([]);
              expect(em.flush).not.toHaveBeenCalled();
            }
            expect(em.fork).not.toHaveBeenCalled();
          },
        );
      },
    );
  });
});

describe("conditional authorization", () => {
  describe("conditional service authorization", () => {
    it.each(
      (["member", "workspace"] as const).filter((_row, index) => index === 0),
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
    it("does not require current-member read ability to remove another member", async () => {
      await withIdentity(async ({ workspaceMemberService, workspace, em }) => {
        const actor = RequestContext.get(WorkspaceMember);
        if (!actor) {
          throw new Error("Missing test member");
        }
        actor.id = "blocked";
        const target = Object.assign(new WorkspaceMember(), {
          id: "target",
          workspace,
          roles: ["member"],
          status: "ACTIVE",
        });
        em.findOne.mockResolvedValue(target);
        await expect(
          workspaceMemberService.removeWorkspaceMember(target),
        ).resolves.toEqual(omitCredentials(target, ["key"]));
        expect(() =>
          workspaceMemberService.getCurrentWorkspaceMember(),
        ).toThrow(ForbiddenException);
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
      ).filter((_row, index) => index === 0),
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
      ).filter((_row, index) => index === 0),
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
      ).filter((_row, index) => index === 2),
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
