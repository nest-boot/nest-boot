/* eslint-disable @typescript-eslint/unbound-method */
import { createMongoAbility, subject } from "@casl/ability";
import { type EntityManager, ref, type SessionContext } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";
import { assert } from "vitest";

import { withAuthTestFeatures } from "../../test/fixtures/enabled-auth-features.fixture.js";
import { AuthAbility } from "../auth.ability.js";
import { API_KEY } from "../auth.constants.js";
import { type AuthModuleOptions } from "../auth-module-options.interface.js";
import { Invitation } from "../entities/index.js";
import { Member } from "../entities/member.entity.js";
import { MemberApiKey } from "../entities/member-api-key.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { buildRequestAbility } from "../utils/build-request-ability.util.js";
import { can } from "../utils/can.util.js";
import {
  assertApiKeyPermissionCeiling,
  canGrantPermissions,
} from "../utils/permission-grants.util.js";
import { resolveRequestPermissions } from "../utils/resolve-request-permissions.util.js";
import { serializeAbilityRules } from "../utils/serialize-ability-rules.util.js";
import { RequestIdentity } from "./request-identity.js";

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

describe("RequestIdentity", () => {
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
        const member = Object.assign(new Member(), {
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
              ? Object.assign(new UserApiKey(), { user, permissions: [] })
              : Object.assign(new MemberApiKey(), { member, permissions: [] });
        if (state === "wrong-workspace") {
          Object.assign(member, { workspace: new Workspace() });
        }
        if (state === "wrong-owner") {
          if (apiKey instanceof MemberApiKey) {
            Object.assign(apiKey, { member: new Member() });
          } else {
            Object.assign(member, { user: new User() });
          }
        }
        const valid = state === "active";
        await RequestContext.run(new RequestContext({ type: "test" }), () => {
          RequestIdentity.stage({
            user,
            apiKey,
            session: credential === "session" ? new Session() : null,
            member: state === "no-member" ? null : member,
            workspace: state === "no-workspace" ? null : workspace,
          });
          RequestIdentity.prepare(withAuthTestFeatures(options));
          expect(can("delete", Workspace)).toBe(valid);
          expect(
            canGrantPermissions(withAuthTestFeatures(options), "workspace", [
              "workspace:delete",
            ]),
          ).toBe(valid);
          expect(can("read", User)).toBe(
            credential === "session" || credential === "user-key",
          );
          RequestIdentity.syncDatabase(em);
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
    const member = Object.assign(new Member(), {
      user: new User(),
      workspace,
      roles: ["owner"],
    });
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      const options = { workspace: { enabled: true } };
      RequestIdentity.stage({ workspace, member });
      RequestIdentity.prepare(withAuthTestFeatures(options));
      expect(RequestContext.get(AuthAbility)?.can("read", Workspace)).toBe(
        false,
      );
      expect(
        canGrantPermissions(withAuthTestFeatures(options), "workspace", [
          "workspace:read",
        ]),
      ).toBe(false);
      RequestIdentity.syncDatabase(em);
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
    const first = Object.assign(new Member(), { user, workspace });
    const second = Object.assign(new Member(), { user, workspace });
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestIdentity.stage({ user, workspace, member: first });
      RequestIdentity.syncDatabase(em);
      expect(em.setSessionContext).toHaveBeenLastCalledWith({
        role: "authenticated",
        variables: {
          "app.user.id": user.id,
          "app.workspace.id": workspace.id,
          "app.system_account.id": "",
          "app.member.id": first.id,
        },
      });
      RequestIdentity.update(
        em,
        withAuthTestFeatures({ workspace: { enabled: true } }),
        { member: second },
      );
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
      RequestIdentity.updateMember(
        em,
        withAuthTestFeatures({ workspace: { enabled: true } }),
        second,
      );
      expect(em.setSessionContext).toHaveBeenLastCalledWith({
        role: "authenticated",
        variables: {
          "app.user.id": user.id,
          "app.workspace.id": "",
          "app.system_account.id": "",
          "app.member.id": "",
        },
      });
      RequestIdentity.clear(em);
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
    const member = Object.assign(new Member(), {
      id: "member",
      roles: ["owner"],
      status: "ACTIVE",
      user,
      workspace,
    });
    const apiKey = Object.assign(new UserApiKey(), {
      id: "key",
      enabled: true,
      permissions: ["user:read", "workspace:delete"],
    });
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestIdentity.stage({
        user,
        member,
        workspace,
        apiKey,
      });
      RequestIdentity.prepare(withAuthTestFeatures(options));
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
      RequestIdentity.prepare(withAuthTestFeatures(options));
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
      RequestIdentity.updateUser(
        manager(),
        withAuthTestFeatures(options),
        user,
      );
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
      RequestIdentity.updateApiKey(
        manager(),
        withAuthTestFeatures(options),
        apiKey,
      );
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
      RequestIdentity.stage({ user });
      const parent = resolveRequestPermissions(withAuthTestFeatures(options));
      await RequestContext.child(() => {
        RequestIdentity.stage({
          apiKey: Object.assign(new UserApiKey(), { permissions: [] }),
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
        RequestIdentity.stage({
          user: Object.assign(new User(), { id: "old" }),
          member: new Member(),
          workspace: new Workspace(),
          session: new Session(),
        });
        expect(() => {
          RequestIdentity.update(em, withAuthTestFeatures(options), {
            user: Object.assign(new User(), { id: "new" }),
          });
        }).toThrow();
        expect(RequestContext.get(User)).toBeNull();
        expect(RequestContext.get(Session)).toBeNull();
        expect(RequestContext.get(Member)).toBeNull();
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
      RequestIdentity.stage({
        user: Object.assign(new User(), { roles: ["admin"] }),
        workspace: new Workspace(),
        member: new Member(),
      });
      expect(() => {
        RequestIdentity.prepare(withAuthTestFeatures(options));
      }).toThrow("Failed");
      expect(can("delete", User)).toBe(false);
      expect(can("read", Workspace)).toBe(false);
    });
  });
  it.each([UserApiKey, MemberApiKey])(
    "clears workspace scope with the correct credential lifetime for %s",
    async (Key) => {
      const em = manager();
      const options = { workspace: { enabled: true } };
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const key = Object.assign(new Key(), {
          permissions: ["user:read", "workspace:delete"],
        });
        RequestIdentity.stage({
          apiKey: key,
          user:
            Key === UserApiKey
              ? Object.assign(new User(), { roles: ["admin"] })
              : null,
          member:
            Key === UserApiKey
              ? Object.assign(new Member(), { roles: ["owner"] })
              : null,
          workspace: new Workspace(),
        });
        RequestIdentity.prepare(withAuthTestFeatures(options));
        RequestIdentity.clearWorkspace(
          em,
          withAuthTestFeatures({ workspace: { enabled: true } }),
        );
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
    RequestIdentity.stage({ user: new User() });
    RequestIdentity.prepare(
      withAuthTestFeatures({ workspace: { enabled: true } }),
    );
    RequestIdentity.refresh(
      withAuthTestFeatures({ workspace: { enabled: true } }),
    );
    RequestIdentity.update(
      em,
      withAuthTestFeatures({ workspace: { enabled: true } }),
      { user: new User() },
    );
    RequestIdentity.updateUser(
      em,
      withAuthTestFeatures({ workspace: { enabled: true } }),
      new User(),
    );
    RequestIdentity.updateMember(
      em,
      withAuthTestFeatures({ workspace: { enabled: true } }),
      new Member(),
    );
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
            Member,
            Object.assign(new Member(), { roles: ["owner"], status: "ACTIVE" }),
          );
          RequestContext.set(Workspace, new Workspace());
          Object.assign(requireMember(), {
            user: RequestContext.get(User),
            workspace: RequestContext.get(Workspace),
          });
          RequestContext.set(
            API_KEY,
            Object.assign(new UserApiKey(), {
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
            RequestIdentity.refresh(withAuthTestFeatures(options));
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
   * @returns Member stored in the current test context.
   */
  function requireMember(): Member {
    const member = RequestContext.get(Member);
    assert(member);
    return member;
  }
});

describe("identity assertions", () => {
  describe("request identity checks", () => {
    it.each([
      [User, RequestIdentity.assertCurrentUser.bind(RequestIdentity)],
      [Session, RequestIdentity.assertCurrentSession.bind(RequestIdentity)],
      [Workspace, RequestIdentity.assertCurrentWorkspace.bind(RequestIdentity)],
      [Member, RequestIdentity.assertCurrentMember.bind(RequestIdentity)],
    ] as const)(
      "checks current %s identity inside and outside a request",
      async (Entity, check) => {
        const target = Object.assign(new Entity(), { id: "one", token: "one" });
        const invoke = (entity: unknown) => {
          check(entity as never);
        };
        expect(() => {
          invoke(target);
        }).toThrow(ForbiddenException);
        await RequestContext.run(
          new RequestContext({ type: "test" }),
          (context) => {
            expect(() => {
              invoke(target);
            }).toThrow(ForbiddenException);
            context.set<InstanceType<typeof Entity>>(Entity, target);
            expect(() => {
              invoke(target);
            }).not.toThrow();
            expect(() => {
              invoke(Object.assign(new Entity(), { id: "two", token: "two" }));
            }).toThrow(ForbiddenException);
          },
        );
      },
    );
    it("rejects a missing member before touching its identity", () => {
      expect(() => {
        RequestIdentity.assertCurrentMember(null);
      }).toThrow(ForbiddenException);
      expect(() => {
        RequestIdentity.assertCurrentMember(undefined);
      }).toThrow(ForbiddenException);
    });
    it.each([UserApiKey, MemberApiKey])(
      "keeps self-service unavailable to %s",
      async (Key) => {
        await RequestContext.run(new RequestContext({ type: "test" }), () => {
          const user = new User();
          RequestIdentity.stage({ user });
          expect(() => {
            RequestIdentity.assertUserSession(user);
          }).not.toThrow();
          expect(() => {
            RequestIdentity.assertUserSession(new User());
          }).toThrow(ForbiddenException);
          RequestIdentity.stage({ apiKey: new Key() });
          expect(() => {
            RequestIdentity.assertUserSession(user);
          }).toThrow("requires a user session");
        });
      },
    );
  });
});

describe("unified request abilities", () => {
  /**
   * Returns user, workspace, and member used by the authorization fixture.
   * @returns User, workspace, and member used by the authorization fixture.
   */
  function identity() {
    const user = Object.assign(new User(), { roles: ["admin"] });
    const workspace = new Workspace();
    const member = Object.assign(new Member(), {
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
        current.member.permissions = ["member:read"];
        const apiKey = Object.assign(new MemberApiKey(), {
          member: ref(Member, current.member),
          permissions: ["member:read", "member:write"],
        });
        RequestIdentity.stage({ ...current, apiKey });
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
        RequestIdentity.stage({ member: current.member });
        expect(
          buildRequestAbility(
            withAuthTestFeatures({ workspace: { enabled: true } }),
          ).can("read", current.member),
        ).toBe(false);
        current.member.status = "DISABLED";
        RequestIdentity.stage({ member: current.member });
        expect(
          buildRequestAbility(
            withAuthTestFeatures({ workspace: { enabled: true } }),
          ).can("read", Member),
        ).toBe(false);
      });
    });

    it("applies shared restrictions after grants from either permission source", async () => {
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const current = identity();
        current.user.permissions = ["report:read"];
        current.member.permissions = ["report:read"];
        RequestIdentity.stage(current);
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
        RequestIdentity.stage(first);
        RequestIdentity.prepare(
          withAuthTestFeatures({ workspace: { enabled: true } }),
        );
        const second = identity();
        second.member.user = ref(User, first.user);
        const em = {
          getSessionContext: vi.fn(() => ({})),
          setSessionContext: vi.fn(),
        };
        RequestIdentity.update(
          em as never,
          withAuthTestFeatures({ workspace: { enabled: true } }),
          { workspace: second.workspace, member: second.member },
        );
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
        RequestIdentity.stage(current);
        RequestIdentity.prepare(
          withAuthTestFeatures({
            workspace: { enabled: true },
            buildAbility: configure,
          }),
        );
        RequestIdentity.prepare(
          withAuthTestFeatures({
            workspace: { enabled: true },
            buildAbility: configure,
          }),
        );
        const ability = RequestContext.get(AuthAbility);
        assert(ability);
        expect(configure).toHaveBeenCalledOnce();
        expect(configure.mock.calls[0][1]).toMatchObject(current);
        expect(configure.mock.calls[0][1].userPermissions).toContain(
          "user:read",
        );
        expect(configure.mock.calls[0][1].workspacePermissions).toContain(
          "member:write",
        );
        expect(ability.can("read", User)).toBe(true);
        expect(ability.can("create", Workspace)).toBe(true);
        expect(ability.can("write", current.member)).toBe(true);
      });
    });

    it("keeps workspace conditions on entities and serialized client subjects", async () => {
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const current = identity();
        RequestIdentity.stage(current);
        const ability = buildRequestAbility(
          withAuthTestFeatures({ workspace: { enabled: true } }),
        );
        const restored = createMongoAbility(serializeAbilityRules(ability));
        for (const Entity of [Member, Invitation, MemberApiKey]) {
          const own = Object.assign(new Entity(), {
            workspace: ref(Workspace, current.workspace),
            member: ref(Member, current.member),
          });
          const other = Object.assign(new Entity(), {
            workspace: ref(Workspace, new Workspace()),
            member: ref(
              Member,
              Object.assign(new Member(), {
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
          RequestIdentity.stage({
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
          expect(ability.can("write", Member)).toBe(false);
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
          RequestIdentity.stage(current);
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

    it.each([UserApiKey, MemberApiKey])(
      "bounds combined rules by %s credentials",
      async (Entity) => {
        await RequestContext.run(new RequestContext({ type: "test" }), () => {
          const current = identity();
          const apiKey = Object.assign(new Entity(), {
            permissions: ["member:read"],
            user: ref(User, current.user),
            workspace: ref(Workspace, current.workspace),
            member: ref(Member, current.member),
          });
          RequestIdentity.stage({ ...current, apiKey });
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
          if (Entity === MemberApiKey) {
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
        RequestIdentity.stage(current);
        RequestIdentity.prepare(withAuthTestFeatures(options));
        expect(RequestContext.get(AuthAbility)?.can("read", "Report")).toBe(
          true,
        );
        const em = { getSessionContext: vi.fn(), setSessionContext: vi.fn() };
        RequestIdentity.clearWorkspace(
          em as never,
          withAuthTestFeatures(options),
        );
        const ability = RequestContext.get(AuthAbility);
        assert(ability);
        expect(ability.can("read", User)).toBe(true);
        expect(ability.can("read", "Report")).toBe(false);
        expect(ability.can("write", Member)).toBe(false);
      });
    });
  });
});
