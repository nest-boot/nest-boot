/* eslint-disable @typescript-eslint/unbound-method */
import { createMongoAbility, subject } from "@casl/ability";
import { type EntityManager, ref, type SessionContext } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";
import { assert } from "vitest";

import { createTestAuthContext } from "../../test/fixtures/auth-context.fixture.js";
import { stageIdentity } from "../../test/fixtures/auth-context.fixture.js";
import { withAuthTestFeatures } from "../../test/fixtures/enabled-auth-features.fixture.js";
import { ApiKey } from "../api-key/entities/api-key.entity.js";
import { UserApiKey } from "../api-key/objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../api-key/objects/workspace-api-key.object.js";
import { toApiKeyView } from "../api-key/utils/api-key-view.util.js";
import { AuthAbility } from "../common/auth.ability.js";
import { can } from "../common/utils/can.util.js";
import {
  assertApiKeyPermissionCeiling,
  canGrantPermissions,
} from "../common/utils/permission-grants.util.js";
import { resolveRequestPermissions } from "../common/utils/resolve-request-permissions.util.js";
import { serializeAbilityRules } from "../common/utils/serialize-ability-rules.util.js";
import { Workspace } from "../workspace/entities/workspace.entity.js";
import { WorkspaceInvitation } from "../workspace/entities/workspace-invitation.entity.js";
import { WorkspaceMember } from "../workspace/entities/workspace-member.entity.js";
import { API_KEY } from "./constants/auth.constants.js";
import { Session } from "./entities/session.entity.js";
import { User } from "./entities/user.entity.js";
import { type AuthModuleOptions } from "./interfaces/auth-module-options.interface.js";
import { buildRequestAbility } from "./utils/build-request-ability.util.js";

/**
 * Returns entity manager mock that tracks the active session context.
 * @returns Entity manager mock that tracks the active session context.
 */
function manager() {
  let context: SessionContext = { role: "authenticated" };
  return {
    getSessionContext: vi.fn(() => context),
    setSessionContext: vi.fn((scope: SessionContext) => {
      context = {
        role: scope.role ?? context.role,
        variables: { ...context.variables, ...scope.variables },
      };
    }),
  } as unknown as EntityManager;
}

describe("AuthContext", () => {
  describe.each([
    "session",
    "user-key",
    "user-member-key",
    "service-account-key",
  ])("%s workspace identity", (credential) => {
    it.each([
      "active",
      "disabled",
      "wrong-workspace",
      "wrong-owner",
      "no-member",
      "no-workspace",
    ])(
      "uses the same %s member for abilities, delegation and database scope",
      async (state) => {
        const em = manager();
        const options = { workspace: { enabled: true } };
        const workspace = new Workspace();
        const user =
          credential === "service-account-key"
            ? null
            : Object.assign(new User(), { roles: ["admin"] });
        const member = Object.assign(new WorkspaceMember(), {
          user,
          workspace,
          type: user ? "USER" : "SERVICE_ACCOUNT",
          roles: ["owner"],
          status: state === "disabled" ? "DISABLED" : "ACTIVE",
        });
        const apiKey =
          credential === "session"
            ? null
            : credential === "user-key"
              ? Object.assign(new UserApiKey(new ApiKey()), {
                  user,
                  permissions: [],
                })
              : Object.assign(new WorkspaceApiKey(new ApiKey()), {
                  member,
                  permissions: [],
                });
        if (state === "wrong-workspace") {
          Object.assign(member, { workspace: new Workspace() });
        }
        if (state === "wrong-owner") {
          if (apiKey instanceof WorkspaceApiKey) {
            Object.assign(apiKey, { member: new WorkspaceMember() });
          } else {
            Object.assign(member, { user: new User() });
          }
        }
        const valid = state === "active";
        await RequestContext.run(new RequestContext({ type: "test" }), () => {
          stageIdentity({
            user,
            apiKey,
            session: credential === "session" ? new Session() : null,
            member: state === "no-member" ? null : member,
            workspace: state === "no-workspace" ? null : workspace,
          });
          createTestAuthContext(
            undefined,
            withAuthTestFeatures(options),
          ).getAbility();
          expect(can("delete", Workspace)).toBe(valid);
          expect(
            canGrantPermissions(withAuthTestFeatures(options), "workspace", [
              "workspace:delete",
            ]),
          ).toBe(valid);
          expect(can("read", User)).toBe(
            credential === "session" || credential === "user-key",
          );
          createTestAuthContext(em, {}).initialize({});
          expect(em.setSessionContext).toHaveBeenLastCalledWith({
            role: "authenticated",
            variables: {
              "app.user.id": user?.id ?? "",
              "app.workspace.id": valid ? workspace.id : "",
              "app.system_account.id": "",
              "app.member.id": valid ? member.id : "",
            },
          });
        });
      },
    );
  });
  it("preserves anonymous workspace selection without granting membership", async () => {
    const em = manager();
    const workspace = new Workspace();
    const member = Object.assign(new WorkspaceMember(), {
      user: new User(),
      workspace,
      roles: ["owner"],
    });
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      const options = { workspace: { enabled: true } };
      stageIdentity({ workspace, member });
      createTestAuthContext(
        undefined,
        withAuthTestFeatures(options),
      ).getAbility();
      expect(RequestContext.get(AuthAbility)?.can("read", Workspace)).toBe(
        false,
      );
      expect(
        canGrantPermissions(withAuthTestFeatures(options), "workspace", [
          "workspace:read",
        ]),
      ).toBe(false);
      createTestAuthContext(em, {}).initialize({});
      expect(em.setSessionContext).toHaveBeenCalledWith({
        role: "anonymous",
        variables: {
          "app.user.id": "",
          "app.workspace.id": workspace.id,
          "app.system_account.id": "",
          "app.member.id": "",
        },
      });
    });
  });
  it("synchronizes member switches in the same workspace and clears revoked membership", async () => {
    const em = manager();
    const workspace = new Workspace();
    const user = new User();
    const first = Object.assign(new WorkspaceMember(), { user, workspace });
    const second = Object.assign(new WorkspaceMember(), { user, workspace });
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      stageIdentity({ user, workspace, member: first });
      createTestAuthContext(em, {}).initialize({});
      expect(em.setSessionContext).toHaveBeenLastCalledWith({
        role: "authenticated",
        variables: {
          "app.user.id": user.id,
          "app.workspace.id": workspace.id,
          "app.system_account.id": "",
          "app.member.id": first.id,
        },
      });
      createTestAuthContext(
        em,
        withAuthTestFeatures({ workspace: { enabled: true } }),
      ).set({ member: second });
      expect(em.setSessionContext).toHaveBeenLastCalledWith({
        role: "authenticated",
        variables: {
          "app.user.id": user.id,
          "app.workspace.id": workspace.id,
          "app.system_account.id": "",
          "app.member.id": second.id,
        },
      });
      second.status = "DISABLED";
      createTestAuthContext(
        em,
        withAuthTestFeatures({ workspace: { enabled: true } }),
      ).clearWorkspace();
      expect(em.setSessionContext).toHaveBeenLastCalledWith({
        role: "authenticated",
        variables: {
          "app.user.id": user.id,
          "app.workspace.id": "",
          "app.system_account.id": "",
          "app.member.id": "",
        },
      });
      createTestAuthContext(em, {}).clear();
      expect(em.setSessionContext).toHaveBeenLastCalledWith({
        role: "anonymous",
        variables: {
          "app.user.id": "",
          "app.workspace.id": "",
          "app.system_account.id": "",
          "app.member.id": "",
        },
      });
    });
  });
  it("shares one immutable permission snapshot between abilities and delegation until publication", async () => {
    const options: AuthModuleOptions = { workspace: { enabled: true } };

    const roles = vi.fn(() => ["admin"]);
    const user = Object.assign(new User(), { id: "user", permissions: [] });
    Object.defineProperty(user, "roles", { get: roles });
    const workspace = new Workspace();
    const member = Object.assign(new WorkspaceMember(), {
      id: "member",
      roles: ["owner"],
      status: "ACTIVE",
      user,
      workspace,
    });
    const apiKey = Object.assign(new ApiKey(), {
      id: "key",
      owner: ref(User, user),
      revokedAt: null,
      permissions: ["user:read", "workspace:delete"],
    });
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      stageIdentity({
        user,
        member,
        workspace,
        apiKey: new UserApiKey(apiKey),
      });
      createTestAuthContext(
        undefined,
        withAuthTestFeatures(options),
      ).getAbility();
      const first = resolveRequestPermissions(withAuthTestFeatures(options));
      expect(
        resolveRequestPermissions(withAuthTestFeatures(options)).apiKey,
      ).toBe(first.apiKey);
      expect(Object.isFrozen(first.apiKey)).toBe(true);
      expect(Object.isFrozen(first.user)).toBe(true);
      expect(can("read", User)).toBe(true);
      expect(can("delete", User)).toBe(false);
      expect(
        canGrantPermissions(withAuthTestFeatures(options), "user", [
          "user:read",
        ]),
      ).toBe(true);
      expect(
        canGrantPermissions(withAuthTestFeatures(options), "user", [
          "user:delete",
        ]),
      ).toBe(false);
      expect(
        canGrantPermissions(withAuthTestFeatures(options), "workspace", [
          "workspace:delete",
        ]),
      ).toBe(true);
      createTestAuthContext(
        undefined,
        withAuthTestFeatures(options),
      ).getAbility();
      expect(resolveRequestPermissions(withAuthTestFeatures(options))).toBe(
        first,
      );
      expect(roles).toHaveBeenCalledOnce();
      roles.mockReturnValue(["user"]);
      // Pending writes do not publish a new authorization state.
      expect(
        canGrantPermissions(withAuthTestFeatures(options), "user", [
          "user:read",
        ]),
      ).toBe(true);
      createTestAuthContext(manager(), withAuthTestFeatures(options)).set({
        user: user,
      });
      expect(roles).toHaveBeenCalledTimes(2);
      expect(resolveRequestPermissions(withAuthTestFeatures(options))).not.toBe(
        first,
      );
      expect(can("read", User)).toBe(false);
      expect(
        canGrantPermissions(withAuthTestFeatures(options), "user", [
          "user:read",
        ]),
      ).toBe(false);
      apiKey.permissions = [];
      expect(
        resolveRequestPermissions(withAuthTestFeatures(options)).apiKey,
      ).toEqual(["user:read", "workspace:delete"]);
      createTestAuthContext(manager(), withAuthTestFeatures(options)).set({
        apiKey: toApiKeyView(apiKey),
      });
      expect(
        resolveRequestPermissions(withAuthTestFeatures(options)).apiKey,
      ).toBeNull();
      expect(
        canGrantPermissions(withAuthTestFeatures(options), "workspace", [
          "workspace:delete",
        ]),
      ).toBe(true);
      expect(() => {
        assertApiKeyPermissionCeiling(options, ["workspace:delete"]);
      }).not.toThrow();
    });
  });
  it("isolates child-context snapshots from the parent identity", async () => {
    const options = { workspace: { enabled: true } };
    const user = Object.assign(new User(), { roles: ["admin"] });
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      stageIdentity({ user });
      const parent = resolveRequestPermissions(withAuthTestFeatures(options));
      await RequestContext.child(() => {
        stageIdentity({
          apiKey: Object.assign(new UserApiKey(new ApiKey()), {
            permissions: [],
          }),
        });
        expect(
          resolveRequestPermissions(withAuthTestFeatures(options)).user,
        ).toEqual(parent.user);
      });
      expect(resolveRequestPermissions(withAuthTestFeatures(options))).toBe(
        parent,
      );
      expect(parent.user).toContain("user:delete");
    });
  });
  it.each(["ability", "database"] as const)(
    "revokes identity and both abilities when %s publication fails",
    async (failure) => {
      const em = manager();
      const options: AuthModuleOptions = {
        buildAbility: (_rules) => {
          if (failure === "ability") {
            throw new Error("Ability failed");
          }
        },

        workspace: { enabled: true },
      };
      if (failure === "database") {
        vi.mocked(em.setSessionContext).mockImplementationOnce(() => {
          throw new Error("Database failed");
        });
      }
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        stageIdentity({
          user: Object.assign(new User(), { id: "old" }),
          member: new WorkspaceMember(),
          workspace: new Workspace(),
          session: new Session(),
        });
        expect(() => {
          createTestAuthContext(em, withAuthTestFeatures(options)).set({
            user: Object.assign(new User(), { id: "new" }),
          });
        }).toThrow();
        expect(RequestContext.get(User)).toBeNull();
        expect(RequestContext.get(Session)).toBeNull();
        expect(RequestContext.get(WorkspaceMember)).toBeNull();
        expect(RequestContext.get(Workspace)).toBeNull();
        expect(RequestContext.get(API_KEY)).toBeNull();
        expect(RequestContext.get(AuthAbility)?.rules).toEqual([]);
        expect(
          resolveRequestPermissions(withAuthTestFeatures(options)),
        ).toEqual({
          user: [],
          workspace: [],
          apiKey: null,
        });
        expect(em.setSessionContext).toHaveBeenLastCalledWith({
          role: "anonymous",
          variables: {
            "app.user.id": "",
            "app.workspace.id": "",
            "app.system_account.id": "",
            "app.member.id": "",
          },
        });
      });
    },
  );
  it("does not leave a partially prepared ability after a builder fails", async () => {
    const options: AuthModuleOptions = {
      buildAbility: (_rules) => {
        throw new Error("Failed");
      },

      workspace: { enabled: true },
    };
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      stageIdentity({
        user: Object.assign(new User(), { roles: ["admin"] }),
        workspace: new Workspace(),
        member: new WorkspaceMember(),
      });
      expect(() => {
        createTestAuthContext(
          undefined,
          withAuthTestFeatures(options),
        ).getAbility();
      }).toThrow("Failed");
      expect(can("delete", User)).toBe(false);
      expect(can("read", Workspace)).toBe(false);
    });
  });
  it.each([UserApiKey, WorkspaceApiKey])(
    "clears workspace scope with the correct credential lifetime for %s",
    async (Key) => {
      const em = manager();
      const options = { workspace: { enabled: true } };
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const key = Object.assign(new Key(), {
          permissions: ["user:read", "workspace:delete"],
        });
        stageIdentity({
          apiKey: key,
          user:
            Key === UserApiKey
              ? Object.assign(new User(), { roles: ["admin"] })
              : null,
          member:
            Key === UserApiKey
              ? Object.assign(new WorkspaceMember(), { roles: ["owner"] })
              : null,
          workspace: new Workspace(),
        });
        createTestAuthContext(
          undefined,
          withAuthTestFeatures(options),
        ).getAbility();
        createTestAuthContext(
          em,
          withAuthTestFeatures({ workspace: { enabled: true } }),
        ).clearWorkspace();
        expect(
          resolveRequestPermissions(withAuthTestFeatures(options)).workspace,
        ).toEqual([]);
        expect(RequestContext.get(AuthAbility)?.can("delete", Workspace)).toBe(
          false,
        );
        expect(RequestContext.get(API_KEY)).toBe(
          Key === UserApiKey ? key : null,
        );
        if (Key === UserApiKey) {
          expect(can("read", User)).toBe(true);
        } else {
          expect(() => can("read", User)).toThrow(ForbiddenException);
        }
      });
    },
  );
  it("does not stage authorization outside an active request", () => {
    const em = manager();
    stageIdentity({ user: new User() });
    createTestAuthContext(
      undefined,
      withAuthTestFeatures({ workspace: { enabled: true } }),
    ).getAbility();
    createTestAuthContext(
      undefined,
      withAuthTestFeatures({ workspace: { enabled: true } }),
    ).refresh();
    createTestAuthContext(
      em,
      withAuthTestFeatures({ workspace: { enabled: true } }),
    ).set({ user: new User() });
    createTestAuthContext(
      em,
      withAuthTestFeatures({ workspace: { enabled: true } }),
    ).set({ user: new User() });
    createTestAuthContext(
      em,
      withAuthTestFeatures({ workspace: { enabled: true } }),
    ).clearWorkspace();
    expect(em.setSessionContext).not.toHaveBeenCalled();
    expect(
      resolveRequestPermissions(
        withAuthTestFeatures({ workspace: { enabled: true } }),
      ),
    ).toEqual({
      user: [],
      workspace: [],
      apiKey: null,
    });
  });
});

describe("post-commit authorization", () => {
  describe("post-commit request authorization", () => {
    it.each([false, true])(
      "retains API-key ceilings and fails closed if the custom builder throws (failure=%s)",
      async (failure) => {
        const options: AuthModuleOptions = {
          buildAbility: (_rules) => {
            if (failure) {
              throw new Error("Invalid ability configuration");
            }
          },

          user: {
            roles: { admin: ["user:read", "user:delete"] },
          },
          workspace: {
            enabled: true,
            roles: { owner: ["workspace:read", "workspace:delete"] },
          },
        };
        await RequestContext.run(new RequestContext({ type: "test" }), () => {
          RequestContext.set(
            User,
            Object.assign(new User(), { roles: ["admin"] }),
          );
          RequestContext.set(
            WorkspaceMember,
            Object.assign(new WorkspaceMember(), {
              roles: ["owner"],
              status: "ACTIVE",
            }),
          );
          RequestContext.set(Workspace, new Workspace());
          Object.assign(requireWorkspaceMember(), {
            user: RequestContext.get(User),
            workspace: RequestContext.get(Workspace),
          });
          RequestContext.set(
            API_KEY,
            Object.assign(new UserApiKey(new ApiKey()), {
              permissions: ["user:read", "workspace:read"],
            }),
          );
          RequestContext.set(
            AuthAbility,
            new AuthAbility([
              { action: "delete", subject: User },
              { action: "delete", subject: Workspace },
            ]),
          );
          const refresh = () => {
            createTestAuthContext(
              undefined,
              withAuthTestFeatures(options),
            ).refresh();
          };
          if (failure) {
            expect(refresh).toThrow("Invalid ability configuration");
          } else {
            refresh();
          }
          expect(RequestContext.get(AuthAbility)?.can("delete", User)).toBe(
            false,
          );
          expect(
            RequestContext.get(AuthAbility)?.can("delete", Workspace),
          ).toBe(false);
          expect(RequestContext.get(AuthAbility)?.can("read", User)).toBe(
            !failure,
          );
          expect(RequestContext.get(AuthAbility)?.can("read", Workspace)).toBe(
            !failure,
          );
        });
      },
    );
  });
  /**
   * Returns member stored in the current test context.
   * @returns WorkspaceMember stored in the current test context.
   */
  function requireWorkspaceMember(): WorkspaceMember {
    const member = RequestContext.get(WorkspaceMember);
    assert(member);
    return member;
  }
});

describe("unified request abilities", () => {
  /**
   * Returns user, workspace, and member used by the authorization fixture.
   * @returns User, workspace, and member used by the authorization fixture.
   */
  function identity() {
    const user = Object.assign(new User(), { roles: ["admin"] });
    const workspace = new Workspace();
    const member = Object.assign(new WorkspaceMember(), {
      roles: ["owner"],
      user: ref(User, user),
      workspace: ref(Workspace, workspace),
    });
    return { user, workspace, member };
  }

  describe("unified request ability", () => {
    it("intersects member permissions with workspace key grants and revokes disabled membership", async () => {
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const current = identity();
        current.member.roles = [];
        current.member.permissions = ["workspace-member:read"];
        const apiKey = Object.assign(new WorkspaceApiKey(new ApiKey()), {
          member: ref(WorkspaceMember, current.member),
          permissions: ["workspace-member:read", "workspace-member:write"],
        });
        stageIdentity({ ...current, apiKey });
        expect(
          buildRequestAbility(
            withAuthTestFeatures({ workspace: { enabled: true } }),
          ).can("read", current.member),
        ).toBe(true);
        expect(
          buildRequestAbility(
            withAuthTestFeatures({ workspace: { enabled: true } }),
          ).can("write", current.member),
        ).toBe(false);
        current.member.permissions = [];
        stageIdentity({ member: current.member });
        expect(
          buildRequestAbility(
            withAuthTestFeatures({ workspace: { enabled: true } }),
          ).can("read", current.member),
        ).toBe(false);
        current.member.status = "DISABLED";
        stageIdentity({ member: current.member });
        expect(
          buildRequestAbility(
            withAuthTestFeatures({ workspace: { enabled: true } }),
          ).can("read", WorkspaceMember),
        ).toBe(false);
      });
    });

    it("applies shared restrictions after grants from either permission source", async () => {
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const current = identity();
        current.user.permissions = ["report:read"];
        current.member.permissions = ["report:read"];
        stageIdentity(current);
        const ability = buildRequestAbility(
          withAuthTestFeatures({
            user: { permissions: ["report:read"] },
            workspace: { enabled: true, permissions: ["report:read"] },
            buildAbility: ({ can, cannot }) => {
              can({ user: "report:read" }, "read", "Report");
              cannot("read", "Report", { private: true });
              cannot("update", "User");
              can({ workspace: "report:read" }, "read", "Report");
            },
          }),
        );
        expect(ability.can("read", subject("Report", { private: false }))).toBe(
          true,
        );
        expect(ability.can("read", subject("Report", { private: true }))).toBe(
          false,
        );
        expect(ability.can("update", current.user)).toBe(false);
      });
    });

    it("replaces workspace conditions instead of accumulating grants on a switch", async () => {
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const first = identity();
        stageIdentity(first);
        createTestAuthContext(
          undefined,
          withAuthTestFeatures({ workspace: { enabled: true } }),
        ).getAbility();
        const second = identity();
        second.member.user = ref(User, first.user);
        const em = {
          getSessionContext: vi.fn(() => ({})),
          setSessionContext: vi.fn(),
        };
        createTestAuthContext(
          em,
          withAuthTestFeatures({ workspace: { enabled: true } }),
        ).set({ workspace: second.workspace, member: second.member });
        const ability = RequestContext.get(AuthAbility);
        assert(ability);
        expect(ability.can("write", first.member)).toBe(false);
        expect(ability.can("write", second.member)).toBe(true);
        expect(ability.can("read", User)).toBe(true);
        expect(em.setSessionContext).toHaveBeenCalledWith({
          role: "authenticated",
          variables: {
            "app.user.id": first.user.id,
            "app.workspace.id": second.workspace.id,
            "app.system_account.id": "",
            "app.member.id": second.member.id,
          },
        });
      });
    });

    it("builds user and workspace rules once with the complete identity context", async () => {
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const current = identity();
        const configure = vi.fn();
        stageIdentity(current);
        createTestAuthContext(
          undefined,
          withAuthTestFeatures({
            workspace: { enabled: true },
            buildAbility: configure,
          }),
        ).getAbility();
        createTestAuthContext(
          undefined,
          withAuthTestFeatures({
            workspace: { enabled: true },
            buildAbility: configure,
          }),
        ).getAbility();
        const ability = RequestContext.get(AuthAbility);
        assert(ability);
        expect(configure).toHaveBeenCalledOnce();
        expect(configure.mock.calls[0][1]).toMatchObject(current);
        expect(configure.mock.calls[0][1].userPermissions).toContain(
          "user:read",
        );
        expect(configure.mock.calls[0][1].workspacePermissions).toContain(
          "workspace-member:write",
        );
        expect(ability.can("read", User)).toBe(true);
        expect(ability.can("create", Workspace)).toBe(true);
        expect(ability.can("write", current.member)).toBe(true);
      });
    });

    it("keeps workspace conditions on entities and serialized client subjects", async () => {
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const current = identity();
        stageIdentity(current);
        const ability = buildRequestAbility(
          withAuthTestFeatures({ workspace: { enabled: true } }),
        );
        const restored = createMongoAbility(serializeAbilityRules(ability));
        for (const Entity of [
          WorkspaceMember,
          WorkspaceInvitation,
          WorkspaceApiKey,
        ]) {
          const own = Object.assign(new Entity(), {
            workspace: ref(Workspace, current.workspace),
            member: ref(WorkspaceMember, current.member),
          });
          const other = Object.assign(new Entity(), {
            workspace: ref(Workspace, new Workspace()),
            member: ref(
              WorkspaceMember,
              Object.assign(new WorkspaceMember(), {
                workspace: ref(Workspace, new Workspace()),
              }),
            ),
          });
          expect(ability.can("write", Entity)).toBe(true);
          expect(ability.can("write", own)).toBe(true);
          expect(ability.can("write", other)).toBe(false);
          expect(
            restored.can(
              "write",
              subject(Entity.name, {
                workspaceId: own.workspaceId,
                type: "USER",
              }),
            ),
          ).toBe(true);
          expect(
            restored.can(
              "write",
              subject(Entity.name, { workspaceId: other.workspaceId }),
            ),
          ).toBe(false);
        }
        expect(ability.can("update", current.workspace)).toBe(true);
        expect(ability.can("update", new Workspace())).toBe(false);
      });
    });

    it.each(["missing", "disabled", "other-workspace", "other-user"])(
      "omits workspace grants for a %s membership",
      async (state) => {
        await RequestContext.run(new RequestContext({ type: "test" }), () => {
          const current = identity();
          if (state === "disabled") {
            current.member.status = "DISABLED";
          }
          if (state === "other-workspace") {
            current.member.workspace = ref(Workspace, new Workspace());
          }
          if (state === "other-user") {
            current.member.user = ref(User, new User());
          }
          stageIdentity({
            ...current,
            member: state === "missing" ? null : current.member,
          });
          const configure = vi.fn();
          const ability = buildRequestAbility(
            withAuthTestFeatures({
              workspace: { enabled: true },
              buildAbility: configure,
            }),
          );
          expect(ability.can("read", User)).toBe(true);
          expect(ability.can("write", WorkspaceMember)).toBe(false);
          expect(configure.mock.calls[0][1]).toMatchObject({
            workspace: null,
            member: null,
            workspacePermissions: [],
          });
        });
      },
    );

    it.each(["user", "workspace"] as const)(
      "keeps same-name business permission bindings in their %s source",
      async (scope) => {
        await RequestContext.run(new RequestContext({ type: "test" }), () => {
          const current = identity();
          current.user.roles = [];
          current.member.roles = [];
          current[scope === "user" ? "user" : "member"].permissions = [
            "report:read",
          ];
          stageIdentity(current);
          const ability = buildRequestAbility(
            withAuthTestFeatures({
              user: { permissions: ["report:read"] },
              workspace: { enabled: true, permissions: ["report:read"] },
              buildAbility: ({ can }) => {
                can({ user: "report:read" }, "read", "PersonalReport");
                can({ workspace: "report:read" }, "read", "WorkspaceReport");
              },
            }),
          );
          expect(ability.can("read", "PersonalReport")).toBe(scope === "user");
          expect(ability.can("read", "WorkspaceReport")).toBe(
            scope === "workspace",
          );
        });
      },
    );

    it.each([UserApiKey, WorkspaceApiKey])(
      "bounds combined rules by %s credentials",
      async (Entity) => {
        await RequestContext.run(new RequestContext({ type: "test" }), () => {
          const current = identity();
          const apiKey = Object.assign(new Entity(), {
            permissions: ["workspace-member:read"],
            user: ref(User, current.user),
            workspace: ref(Workspace, current.workspace),
            member: ref(WorkspaceMember, current.member),
          });
          stageIdentity({ ...current, apiKey });
          const configure = vi.fn();
          const ability = buildRequestAbility(
            withAuthTestFeatures({
              workspace: { enabled: true },
              buildAbility: configure,
            }),
          );
          expect(ability.can("read", User)).toBe(false);
          expect(ability.can("read", current.member)).toBe(true);
          expect(ability.can("write", current.member)).toBe(false);
          if (Entity === WorkspaceApiKey) {
            expect(configure.mock.calls[0][1]).toMatchObject({
              user: null,
              member: current.member,
              userPermissions: [],
            });
          }
        });
      },
    );

    it("rebuilds after workspace exit, retaining user grants but removing workspace business rules", async () => {
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const current = identity();
        current.member.permissions = ["report:read"];
        const options: AuthModuleOptions = {
          workspace: { enabled: true, permissions: ["report:read"] },
          buildAbility: ({ can }, { workspace }) => {
            if (workspace) {
              can({ workspace: "report:read" }, "read", "Report", {
                workspaceId: workspace.id,
              });
            }
          },
        };
        stageIdentity(current);
        createTestAuthContext(
          undefined,
          withAuthTestFeatures(options),
        ).getAbility();
        expect(RequestContext.get(AuthAbility)?.can("read", "Report")).toBe(
          true,
        );
        const em = { getSessionContext: vi.fn(), setSessionContext: vi.fn() };
        createTestAuthContext(
          em,
          withAuthTestFeatures(options),
        ).clearWorkspace();
        const ability = RequestContext.get(AuthAbility);
        assert(ability);
        expect(ability.can("read", User)).toBe(true);
        expect(ability.can("read", "Report")).toBe(false);
        expect(ability.can("write", WorkspaceMember)).toBe(false);
      });
    });
  });
});
