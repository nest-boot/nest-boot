/* eslint-disable @typescript-eslint/unbound-method */
import type { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";

import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { API_KEY } from "../auth.constants.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Member } from "../entities/member.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { AccessControlService } from "../services/access-control.service.js";
import { resolveRequestPermissions } from "../utils/resolve-request-permissions.util.js";
import { RequestIdentity } from "./request-identity.js";

function manager() {
  return {
    getSessionContext: vi.fn(() => ({ role: "authenticated" })),
    setSessionContext: vi.fn(),
  } as unknown as EntityManager;
}

describe("RequestIdentity", () => {
  it("shares one immutable permission snapshot between abilities and delegation until publication", async () => {
    const options: AuthModuleOptions = {};
    const access = new AccessControlService(options);
    const roles = vi.fn(() => ["admin"]);
    const user = Object.assign(new User(), { id: "user", permissions: [] });
    Object.defineProperty(user, "roles", { get: roles });
    const member = Object.assign(new Member(), {
      id: "member",
      roles: ["owner"],
      status: "ACTIVE",
    });
    const apiKey = Object.assign(new UserApiKey(), {
      id: "key",
      enabled: true,
      permissions: ["user:get", "workspace:delete"],
    });
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestIdentity.stage({
        user,
        member,
        workspace: new Workspace(),
        apiKey,
      });
      RequestIdentity.prepare(options);
      const first = resolveRequestPermissions(options);
      expect(access.getApiKeyPermissionCeiling()).toBe(first.apiKey);
      expect(Object.isFrozen(first.apiKey)).toBe(true);
      expect(Object.isFrozen(first.user)).toBe(true);
      expect(access.userCan("get", User)).toBe(true);
      expect(access.userCan("delete", User)).toBe(false);
      expect(access.canGrantUserPermissions(["user:get"])).toBe(true);
      expect(access.canGrantUserPermissions(["user:delete"])).toBe(false);
      expect(access.canGrantWorkspacePermissions(["workspace:delete"])).toBe(
        true,
      );
      RequestIdentity.prepare(options);
      expect(resolveRequestPermissions(options)).toBe(first);
      expect(roles).toHaveBeenCalledOnce();

      roles.mockReturnValue(["user"]);
      // Pending writes do not publish a new authorization state.
      expect(access.canGrantUserPermissions(["user:get"])).toBe(true);
      RequestIdentity.updateUser(manager(), options, user);
      expect(roles).toHaveBeenCalledTimes(2);
      expect(resolveRequestPermissions(options)).not.toBe(first);
      expect(access.userCan("get", User)).toBe(false);
      expect(access.canGrantUserPermissions(["user:get"])).toBe(false);
      apiKey.permissions = [];
      expect(access.getApiKeyPermissionCeiling()).toEqual([
        "user:get",
        "workspace:delete",
      ]);
      RequestIdentity.updateApiKey(manager(), options, apiKey);
      expect(access.getApiKeyPermissionCeiling()).toEqual([]);
      expect(access.canGrantWorkspacePermissions(["workspace:delete"])).toBe(
        false,
      );
      expect(() => {
        access.assertApiKeyPermissionCeiling(["workspace:delete"]);
      }).toThrow("exceed");
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
        expect(resolveRequestPermissions(options).user).toEqual([]);
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
        workspace: {
          buildAbility: () => {
            if (failure === "ability") throw new Error("Ability failed");
          },
        },
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
        expect(RequestContext.get(UserAbility)?.rules).toEqual([]);
        expect(RequestContext.get(WorkspaceAbility)?.rules).toEqual([]);
        expect(resolveRequestPermissions(options)).toEqual({
          user: [],
          workspace: [],
          apiKey: null,
        });
        expect(em.setSessionContext).toHaveBeenLastCalledWith({
          role: "anonymous",
          variables: { "app.user.id": "", "app.workspace.id": "" },
        });
      });
    },
  );

  it("does not leave a partially prepared ability after a builder fails", async () => {
    const options: AuthModuleOptions = {
      workspace: {
        buildAbility: () => {
          throw new Error("Failed");
        },
      },
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
      const access = new AccessControlService(options);
      expect(access.userCan("delete", User)).toBe(false);
      expect(access.workspaceCan("read", Workspace)).toBe(false);
    });
  });

  it.each([UserApiKey, WorkspaceApiKey])(
    "clears workspace scope with the correct credential lifetime for %s",
    async (Key) => {
      const em = manager();
      const options = {};
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const key = Object.assign(new Key(), {
          permissions: ["user:get", "workspace:delete"],
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
        RequestIdentity.clearWorkspace(em);
        expect(resolveRequestPermissions(options).workspace).toEqual([]);
        expect(
          RequestContext.get(WorkspaceAbility)?.can("delete", Workspace),
        ).toBe(false);
        expect(RequestContext.get(API_KEY)).toBe(
          Key === UserApiKey ? key : null,
        );
        expect(new AccessControlService(options).userCan("get", User)).toBe(
          Key === UserApiKey,
        );
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
