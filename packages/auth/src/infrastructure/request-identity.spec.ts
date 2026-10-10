/* eslint-disable @typescript-eslint/unbound-method */
import type { EntityManager, SessionContext } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { AuthAbility } from "../auth.ability.js";
import { API_KEY } from "../auth.constants.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Member } from "../entities/member.entity.js";
import { MemberApiKey } from "../entities/member-api-key.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { can } from "../utils/can.util.js";
import { assertApiKeyPermissionCeiling } from "../utils/permission-grants.util.js";
import { canGrantPermissions } from "../utils/permission-grants.util.js";
import { resolveRequestPermissions } from "../utils/resolve-request-permissions.util.js";
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
        const options = {};
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
        if (state === "wrong-workspace")
          Object.assign(member, { workspace: new Workspace() });
        if (state === "wrong-owner") {
          if (apiKey instanceof MemberApiKey)
            Object.assign(apiKey, { member: new Member() });
          else Object.assign(member, { user: new User() });
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
          RequestIdentity.prepare(options);
          expect(can("delete", Workspace)).toBe(valid);
          expect(
            canGrantPermissions(options, "workspace", ["workspace:delete"]),
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
      const options = {};
      RequestIdentity.stage({ workspace, member });
      RequestIdentity.prepare(options);
      expect(RequestContext.get(AuthAbility)?.can("read", Workspace)).toBe(
        false,
      );
      expect(
        canGrantPermissions(options, "workspace", ["workspace:read"]),
      ).toBe(false);
      RequestIdentity.syncDatabase(em);
      expect(em.setSessionContext).toHaveBeenCalledWith({
        role: "anonymous",
        variables: {
          "app.user.id": "",
          "app.workspace.id": workspace.id,
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
          "app.member.id": first.id,
        },
      });
      RequestIdentity.update(em, {}, { member: second });
      expect(em.setSessionContext).toHaveBeenLastCalledWith({
        role: "authenticated",
        variables: {
          "app.user.id": user.id,
          "app.workspace.id": workspace.id,
          "app.member.id": second.id,
        },
      });
      second.status = "DISABLED";
      RequestIdentity.updateMember(em, {}, second);
      expect(em.setSessionContext).toHaveBeenLastCalledWith({
        role: "authenticated",
        variables: {
          "app.user.id": user.id,
          "app.workspace.id": "",
          "app.member.id": "",
        },
      });
      RequestIdentity.clear(em);
      expect(em.setSessionContext).toHaveBeenLastCalledWith({
        role: "anonymous",
        variables: {
          "app.user.id": "",
          "app.workspace.id": "",
          "app.member.id": "",
        },
      });
    });
  });

  it("shares one immutable permission snapshot between abilities and delegation until publication", async () => {
    const options: AuthModuleOptions = {};

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
      RequestIdentity.prepare(options);
      const first = resolveRequestPermissions(options);
      expect(resolveRequestPermissions(options).apiKey).toBe(first.apiKey);
      expect(Object.isFrozen(first.apiKey)).toBe(true);
      expect(Object.isFrozen(first.user)).toBe(true);
      expect(can("read", User)).toBe(true);
      expect(can("delete", User)).toBe(false);
      expect(canGrantPermissions(options, "user", ["user:read"])).toBe(true);
      expect(canGrantPermissions(options, "user", ["user:delete"])).toBe(false);
      expect(
        canGrantPermissions(options, "workspace", ["workspace:delete"]),
      ).toBe(true);
      RequestIdentity.prepare(options);
      expect(resolveRequestPermissions(options)).toBe(first);
      expect(roles).toHaveBeenCalledOnce();

      roles.mockReturnValue(["user"]);
      // Pending writes do not publish a new authorization state.
      expect(canGrantPermissions(options, "user", ["user:read"])).toBe(true);
      RequestIdentity.updateUser(manager(), options, user);
      expect(roles).toHaveBeenCalledTimes(2);
      expect(resolveRequestPermissions(options)).not.toBe(first);
      expect(can("read", User)).toBe(false);
      expect(canGrantPermissions(options, "user", ["user:read"])).toBe(false);
      apiKey.permissions = [];
      expect(resolveRequestPermissions(options).apiKey).toEqual([
        "user:read",
        "workspace:delete",
      ]);
      RequestIdentity.updateApiKey(manager(), options, apiKey);
      expect(resolveRequestPermissions(options).apiKey).toBeNull();
      expect(
        canGrantPermissions(options, "workspace", ["workspace:delete"]),
      ).toBe(true);
      expect(() => {
        assertApiKeyPermissionCeiling(options, ["workspace:delete"]);
      }).not.toThrow();
    });
  });

  it("isolates child-context snapshots from the parent identity", async () => {
    const options = {};
    const user = Object.assign(new User(), { roles: ["admin"] });
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestIdentity.stage({ user });
      const parent = resolveRequestPermissions(options);
      await RequestContext.child(() => {
        RequestIdentity.stage({
          apiKey: Object.assign(new UserApiKey(), { permissions: [] }),
        });
        expect(resolveRequestPermissions(options).user).toEqual(parent.user);
      });
      expect(resolveRequestPermissions(options)).toBe(parent);
      expect(parent.user).toContain("user:delete");
    });
  });

  it.each(["ability", "database"] as const)(
    "revokes identity and both abilities when %s publication fails",
    async (failure) => {
      const em = manager();
      const options: AuthModuleOptions = {
        buildAbility: (_rules) => {
          if (failure === "ability") throw new Error("Ability failed");
        },

        workspace: {},
      };
      if (failure === "database")
        vi.mocked(em.setSessionContext).mockImplementationOnce(() => {
          throw new Error("Database failed");
        });
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        RequestIdentity.stage({
          user: Object.assign(new User(), { id: "old" }),
          member: new Member(),
          workspace: new Workspace(),
          session: new Session(),
        });
        expect(() => {
          RequestIdentity.update(em, options, {
            user: Object.assign(new User(), { id: "new" }),
          });
        }).toThrow();
        expect(RequestContext.get(User)).toBeNull();
        expect(RequestContext.get(Session)).toBeNull();
        expect(RequestContext.get(Member)).toBeNull();
        expect(RequestContext.get(Workspace)).toBeNull();
        expect(RequestContext.get(API_KEY)).toBeNull();
        expect(RequestContext.get(AuthAbility)?.rules).toEqual([]);
        expect(resolveRequestPermissions(options)).toEqual({
          user: [],
          workspace: [],
          apiKey: null,
        });
        expect(em.setSessionContext).toHaveBeenLastCalledWith({
          role: "anonymous",
          variables: {
            "app.user.id": "",
            "app.workspace.id": "",
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

      workspace: {},
    };
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestIdentity.stage({
        user: Object.assign(new User(), { roles: ["admin"] }),
        workspace: new Workspace(),
        member: new Member(),
      });
      expect(() => {
        RequestIdentity.prepare(options);
      }).toThrow("Failed");

      expect(can("delete", User)).toBe(false);
      expect(can("read", Workspace)).toBe(false);
    });
  });

  it.each([UserApiKey, MemberApiKey])(
    "clears workspace scope with the correct credential lifetime for %s",
    async (Key) => {
      const em = manager();
      const options = {};
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
        RequestIdentity.prepare(options);
        RequestIdentity.clearWorkspace(em, {});
        expect(resolveRequestPermissions(options).workspace).toEqual([]);
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
    RequestIdentity.prepare({});
    RequestIdentity.refresh({});
    RequestIdentity.update(em, {}, { user: new User() });
    RequestIdentity.updateUser(em, {}, new User());
    RequestIdentity.updateMember(em, {}, new Member());
    expect(em.setSessionContext).not.toHaveBeenCalled();
    expect(resolveRequestPermissions({})).toEqual({
      user: [],
      workspace: [],
      apiKey: null,
    });
  });
});
