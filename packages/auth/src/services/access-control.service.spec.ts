import { subject as caslSubject } from "@casl/ability";
import { ref } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { AuthAbility } from "../abilities/auth.ability.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Member } from "../entities/member.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
import { AccessControlService } from "./access-control.service.js";

class Subject {}

describe("AccessControlService", () => {
  const options: AuthModuleOptions = {};
  const service = new AccessControlService(options);

  it("restricts self-service paths to the current user without API-key delegation", async () => {
    const user = Object.assign(new User(), { id: "user-1" });
    expect(() => {
      service.assertUserSession(user);
    }).toThrow(ForbiddenException);
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(User, user);
      expect(() => {
        service.assertUserSession(user);
      }).not.toThrow();
      expect(() => {
        service.assertUserSession(Object.assign(new User(), { id: "another" }));
      }).toThrow(ForbiddenException);
      RequestIdentity.stage({
        apiKey: Object.assign(new UserApiKey(), {
          user: ref(User, user),
          permissions: [],
        }),
      });
      expect(() => {
        service.assertUserSession(user);
      }).toThrow("requires a user session");
    });
  });

  it("fails closed when no request identity is available", async () => {
    expect(service.can("read", Subject)).toBe(false);
    expect(() => {
      service.assertCan("read", Subject);
    }).toThrow(ForbiddenException);

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      expect(service.can("read", Subject)).toBe(false);
      expect(() => {
        service.assertCanGrantWorkspacePermissions(["subject:read"]);
      }).toThrow("Workspace permissions exceed issuer permissions");
    });
  });

  it("checks the cached user ability", async () => {
    const user = Object.assign(new User(), { id: "user-1" });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(User, user);
      const ability = new AuthAbility();
      vi.spyOn(ability, "can").mockReturnValue(true);
      RequestContext.set(AuthAbility, ability);

      expect(service.can("read", Subject)).toBe(true);
      expect(() => {
        service.assertCan("read", Subject);
      }).not.toThrow();
    });
  });

  it("fails closed when an ability has not been prepared", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(User, new User());

      expect(service.can("read", Subject)).toBe(false);
      expect(() => {
        service.assertCan("read", Subject);
      }).toThrow(ForbiddenException);
    });
  });

  it.each([UserApiKey, WorkspaceApiKey])(
    "rejects a missing owner on %s before checking request identity",
    (Entity) => {
      expect(() => {
        service.assertApiKeyOwner(new Entity());
      }).toThrow("API key owner is missing");
    },
  );

  it("intersects user API-key permissions with the user ability", async () => {
    const user = new User();
    const apiKey = Object.assign(new UserApiKey(), {
      workspace: null,
      user: ref(User, user),
      permissions: ["subject:read"],
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(User, user);
      RequestIdentity.stage({ apiKey });
      const ability = new AuthAbility();
      vi.spyOn(ability, "can").mockImplementation(
        (action) => action === "read",
      );
      RequestContext.set(AuthAbility, ability);

      expect(service.can("read", Subject)).toBe(true);
      expect(service.can("update", Subject)).toBe(false);
    });
  });

  it("allows workspace keys only through their explicit permissions", async () => {
    const workspace = new Workspace();
    const apiKey = Object.assign(new WorkspaceApiKey(), {
      workspace: ref(Workspace, workspace),
      permissions: ["subject:read"],
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestIdentity.stage({ apiKey, workspace });
      const ability = new AuthAbility();
      vi.spyOn(ability, "can").mockImplementation(
        (action) => action === "read",
      );
      RequestContext.set(AuthAbility, ability);

      expect(service.can("read", Subject)).toBe(true);
      expect(service.can("update", Subject)).toBe(false);
    });
  });

  it("uses the forced CASL subject type for service-level API-key checks", async () => {
    const workspace = new Workspace();
    const apiKey = Object.assign(new WorkspaceApiKey(), {
      workspace: ref(Workspace, workspace),
      permissions: ["post:read"],
    });
    const post = caslSubject("Post", { id: "post-1" });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestIdentity.stage({ apiKey, workspace });
      const ability = new AuthAbility();
      vi.spyOn(ability, "can").mockImplementation(
        (action) => action === "read",
      );
      RequestContext.set(AuthAbility, ability);

      expect(service.can("read", post)).toBe(true);
      expect(service.can("update", post)).toBe(false);
    });
  });

  it("uses the workspace ability built from API-key permissions", async () => {
    const workspace = new Workspace();
    const apiKey = Object.assign(new WorkspaceApiKey(), {
      workspace: ref(Workspace, workspace),
      permissions: ["subject:read"],
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestIdentity.stage({ apiKey, workspace });
      RequestContext.set(AuthAbility, new AuthAbility());

      expect(service.can("read", Subject)).toBe(false);
    });
  });

  it("rejects a cached ability when the authenticated identity is removed", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(User, new User());
      RequestContext.set(Member, new Member());
      RequestContext.set(Workspace, new Workspace());
      const ability = new AuthAbility();
      vi.spyOn(ability, "can").mockImplementation(
        (action) => action === "read",
      );
      RequestContext.set(AuthAbility, ability);

      expect(service.can("read", Subject)).toBe(true);
      expect(service.can("update", Subject)).toBe(false);
      RequestIdentity.stage({ user: null, workspace: null, member: null });
      expect(service.can("read", Subject)).toBe(false);
    });
  });

  it("verifies current user, session, workspace, and member identities", async () => {
    const currentUser = Object.assign(new User(), { id: "user-1" });
    const currentSession = Object.assign(new Session(), {
      token: "session-1",
    });
    const currentWorkspace = Object.assign(new Workspace(), {
      id: "workspace-1",
    });
    const currentMember = Object.assign(new Member(), {
      id: "member-1",
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(User, currentUser);
      RequestContext.set(Session, currentSession);
      RequestContext.set(Workspace, currentWorkspace);
      RequestContext.set(Member, currentMember);

      expect(() => {
        service.assertCurrentUser(currentUser);
      }).not.toThrow();
      expect(() => {
        service.assertCurrentSession(currentSession);
      }).not.toThrow();
      expect(() => {
        service.assertCurrentWorkspace(currentWorkspace);
      }).not.toThrow();
      expect(() => {
        service.assertCurrentMember(currentMember);
      }).not.toThrow();
      expect(() => {
        service.assertCurrentUser(Object.assign(new User(), { id: "user-2" }));
      }).toThrow(ForbiddenException);
      expect(() => {
        service.assertCurrentSession(
          Object.assign(new Session(), { token: "session-2" }),
        );
      }).toThrow(ForbiddenException);
      expect(() => {
        service.assertCurrentWorkspace(
          Object.assign(new Workspace(), { id: "workspace-2" }),
        );
      }).toThrow(ForbiddenException);
      expect(() => {
        service.assertCurrentMember(
          Object.assign(new Member(), { id: "member-2" }),
        );
      }).toThrow(ForbiddenException);
    });
  });

  it("limits user grants to role and direct permissions, intersected with a personal key", async () => {
    const ceilingService = new AccessControlService({
      ...options,
      user: {
        defaultRole: "reader",
        roles: { reader: ["user:read"], admin: ["user:delete"] },
      },
    });
    const user = Object.assign(new User(), {
      roles: ["reader"],
      permissions: ["user:set-roles"],
    });
    expect(() => {
      ceilingService.assertCanGrantUserPermissions(["user:read"]);
    }).toThrow(ForbiddenException);
    expect(ceilingService.canGrantUserPermissions(["user:read"])).toBe(false);
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(User, user);
      expect(
        ceilingService.canGrantUserPermissions(["user:read", "user:set-roles"]),
      ).toBe(true);
      expect(ceilingService.canGrantUserPermissions(["user:delete"])).toBe(
        false,
      );
      expect(() => {
        ceilingService.assertCanGrantUserPermissions([
          "user:read",
          "user:set-roles",
        ]);
      }).not.toThrow();
      expect(() => {
        ceilingService.assertCanGrantUserPermissions(["user:delete"]);
      }).toThrow("User permissions exceed issuer permissions: user:delete");
      RequestIdentity.stage({
        apiKey: Object.assign(new UserApiKey(), {
          workspace: null,
          user: user,
          permissions: ["user:read", "user:delete"],
        }),
      });
      expect(() => {
        ceilingService.assertCanGrantUserPermissions(["user:read"]);
      }).not.toThrow();
      expect(() => {
        ceilingService.assertCanGrantUserPermissions(["user:set-roles"]);
      }).toThrow(ForbiddenException);
      expect(ceilingService.canGrantUserPermissions(["user:read"])).toBe(true);
      expect(ceilingService.canGrantUserPermissions(["user:set-roles"])).toBe(
        false,
      );
      expect(ceilingService.canGrantUserPermissions(["user:delete"])).toBe(
        false,
      );
      expect(() => {
        ceilingService.assertCanGrantUserPermissions(["user:delete"]);
      }).toThrow(ForbiddenException);
      RequestIdentity.stage({
        apiKey: Object.assign(new WorkspaceApiKey(), {
          workspace: new Workspace(),
          permissions: ["user:read"],
        }),
      });
      expect(() => {
        ceilingService.assertCanGrantUserPermissions(["user:read"]);
      }).toThrow(ForbiddenException);
      expect(ceilingService.canGrantUserPermissions(["user:read"])).toBe(false);
    });
  });

  it("prevents workspace grants from exceeding the current principal", async () => {
    const ceilingService = new AccessControlService({
      ...options,
      workspace: {
        defaultRole: "member",
        permissions: ["post:read", "post:update", "post:delete"],
        roles: {
          member: ["post:read", "post:update"],
        },
      },
    });
    const user = new User();
    const member = Object.assign(new Member(), {
      permissions: [],
      roles: ["member"],
    });
    const userApiKey = Object.assign(new UserApiKey(), {
      workspace: null,
      user: ref(User, user),
      permissions: ["post:read"],
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestIdentity.stage({ member, workspace: new Workspace() });

      expect(() => {
        ceilingService.assertCanGrantWorkspacePermissions(["post:update"]);
      }).not.toThrow();

      RequestIdentity.stage({ apiKey: userApiKey });
      expect(() => {
        ceilingService.assertCanGrantWorkspacePermissions(["post:read"]);
      }).not.toThrow();
      expect(() => {
        ceilingService.assertCanGrantWorkspacePermissions(["post:update"]);
      }).toThrow(
        "Workspace permissions exceed issuer permissions: post:update",
      );
    });
  });

  it("uses a workspace API key's permissions as its grant ceiling", async () => {
    const workspace = new Workspace();
    const apiKey = Object.assign(new WorkspaceApiKey(), {
      workspace: ref(Workspace, workspace),
      permissions: ["post:read"],
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestIdentity.stage({ apiKey, workspace });

      expect(() => {
        service.assertCanGrantWorkspacePermissions(["post:read"]);
      }).not.toThrow();
      expect(() => {
        service.assertCanGrantWorkspacePermissions(["post:delete"]);
      }).toThrow(
        "Workspace permissions exceed issuer permissions: post:delete",
      );
    });
  });
});
