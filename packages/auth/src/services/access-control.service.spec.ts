import { subject as caslSubject } from "@casl/ability";
import { ref } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
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

  it("fails closed when no request identity is available", async () => {
    expect(service.userCan("read", Subject)).toBe(false);
    expect(service.workspaceCan("read", Subject)).toBe(false);
    expect(() => {
      service.assertWorkspaceCan("read", Subject);
    }).toThrow(ForbiddenException);

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      expect(service.workspaceCan("read", Subject)).toBe(false);
      expect(() => {
        service.assertCanGrantWorkspacePermissions(["subject:read"]);
      }).toThrow("Workspace permissions exceed issuer permissions");
    });
  });

  it("checks the cached user ability", async () => {
    const user = Object.assign(new User(), { id: "user-1" });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(User, user);
      const ability = new UserAbility();
      vi.spyOn(ability, "can").mockReturnValue(true);
      RequestContext.set(UserAbility, ability);

      expect(service.userCan("read", Subject)).toBe(true);
      expect(() => {
        service.assertUserCan("read", Subject);
      }).not.toThrow();
    });
  });

  it("fails closed when an ability has not been prepared", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(User, new User());

      expect(service.userCan("read", Subject)).toBe(false);
      expect(() => {
        service.assertUserCan("read", Subject);
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
      const ability = new UserAbility();
      vi.spyOn(ability, "can").mockImplementation(
        (action) => action === "read",
      );
      RequestContext.set(UserAbility, ability);

      expect(service.userCan("read", Subject)).toBe(true);
      expect(service.userCan("update", Subject)).toBe(false);
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
      const ability = new WorkspaceAbility();
      vi.spyOn(ability, "can").mockImplementation(
        (action) => action === "read",
      );
      RequestContext.set(WorkspaceAbility, ability);

      expect(service.workspaceCan("read", Subject)).toBe(true);
      expect(service.workspaceCan("update", Subject)).toBe(false);
      expect(service.userCan("read", Subject)).toBe(false);
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
      const ability = new WorkspaceAbility();
      vi.spyOn(ability, "can").mockImplementation(
        (action) => action === "read",
      );
      RequestContext.set(WorkspaceAbility, ability);

      expect(service.workspaceCan("read", post)).toBe(true);
      expect(service.workspaceCan("update", post)).toBe(false);
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
      RequestContext.set(WorkspaceAbility, new WorkspaceAbility());

      expect(service.workspaceCan("read", Subject)).toBe(false);
    });
  });

  it("requires a membership and ability for workspace session access", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(Member, new Member());
      RequestContext.set(Workspace, new Workspace());
      const ability = new WorkspaceAbility();
      vi.spyOn(ability, "can").mockImplementation(
        (action) => action === "read",
      );
      RequestContext.set(WorkspaceAbility, ability);

      expect(service.workspaceCan("read", Subject)).toBe(true);
      expect(service.workspaceCan("update", Subject)).toBe(false);
      RequestContext.set(Workspace, null);
      expect(service.workspaceCan("read", Subject)).toBe(false);
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
        roles: { reader: ["user:get"], admin: ["user:delete"] },
      },
    });
    const user = Object.assign(new User(), {
      roles: ["reader"],
      permissions: ["user:set-role"],
    });
    expect(() => {
      ceilingService.assertCanGrantUserPermissions(["user:get"]);
    }).toThrow(ForbiddenException);
    expect(ceilingService.canGrantUserPermissions(["user:get"])).toBe(false);
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(User, user);
      expect(
        ceilingService.canGrantUserPermissions(["user:get", "user:set-role"]),
      ).toBe(true);
      expect(ceilingService.canGrantUserPermissions(["user:delete"])).toBe(
        false,
      );
      expect(() => {
        ceilingService.assertCanGrantUserPermissions([
          "user:get",
          "user:set-role",
        ]);
      }).not.toThrow();
      expect(() => {
        ceilingService.assertCanGrantUserPermissions(["user:delete"]);
      }).toThrow("User permissions exceed issuer permissions: user:delete");
      RequestIdentity.stage({
        apiKey: Object.assign(new UserApiKey(), {
          workspace: null,
          user: user,
          permissions: ["user:get", "user:delete"],
        }),
      });
      expect(() => {
        ceilingService.assertCanGrantUserPermissions(["user:get"]);
      }).not.toThrow();
      expect(() => {
        ceilingService.assertCanGrantUserPermissions(["user:set-role"]);
      }).toThrow(ForbiddenException);
      expect(ceilingService.canGrantUserPermissions(["user:get"])).toBe(true);
      expect(ceilingService.canGrantUserPermissions(["user:set-role"])).toBe(
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
          permissions: ["user:get"],
        }),
      });
      expect(() => {
        ceilingService.assertCanGrantUserPermissions(["user:get"]);
      }).toThrow(ForbiddenException);
      expect(ceilingService.canGrantUserPermissions(["user:get"])).toBe(false);
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
