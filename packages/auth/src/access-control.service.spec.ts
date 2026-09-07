import { subject as caslSubject } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { UserAbility } from "./abilities/user.ability.js";
import { WorkspaceAbility } from "./abilities/workspace.ability.js";
import { AccessControlService } from "./access-control.service.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import {
  BaseApiKey,
  BaseSession,
  BaseUser,
  BaseWorkspace,
  BaseWorkspaceMember,
} from "./entities/index.js";

class TestApiKey extends BaseApiKey {}
class TestSession extends BaseSession {}
class TestUser extends BaseUser {}
class TestWorkspace extends BaseWorkspace {}
class TestWorkspaceMember extends BaseWorkspaceMember {}
class Subject {}

describe("AccessControlService", () => {
  const options = {
    entities: {
      user: TestUser,
      workspace: TestWorkspace,
    },
  } as AuthModuleOptions;
  const service = new AccessControlService(options);

  it("checks the cached user ability", async () => {
    const user = Object.assign(new TestUser(), { id: "user-1" });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseUser, user);
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
      RequestContext.set(BaseUser, new TestUser());

      expect(service.userCan("read", Subject)).toBe(false);
      expect(() => {
        service.assertUserCan("read", Subject);
      }).toThrow(ForbiddenException);
    });
  });

  it("intersects user API-key permissions with the user ability", async () => {
    const user = new TestUser();
    const apiKey = Object.assign(new TestApiKey(), {
      owner: user as BaseApiKey["owner"],
      permissions: ["Subject:read"],
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseUser, user);
      RequestContext.set(BaseApiKey, apiKey);
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
    const workspace = new TestWorkspace();
    const apiKey = Object.assign(new TestApiKey(), {
      owner: workspace as BaseApiKey["owner"],
      permissions: ["Subject:read"],
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseApiKey, apiKey);
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
    const workspace = new TestWorkspace();
    const apiKey = Object.assign(new TestApiKey(), {
      owner: workspace as BaseApiKey["owner"],
      permissions: ["Post:read"],
    });
    const post = caslSubject("Post", { id: "post-1" });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseApiKey, apiKey);
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
    const workspace = new TestWorkspace();
    const apiKey = Object.assign(new TestApiKey(), {
      owner: workspace as BaseApiKey["owner"],
      permissions: ["Subject:read"],
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseApiKey, apiKey);
      RequestContext.set(WorkspaceAbility, new WorkspaceAbility());

      expect(service.workspaceCan("read", Subject)).toBe(false);
    });
  });

  it("requires a membership and ability for workspace session access", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseWorkspaceMember, new TestWorkspaceMember());
      const ability = new WorkspaceAbility();
      vi.spyOn(ability, "can").mockImplementation(
        (action) => action === "read",
      );
      RequestContext.set(WorkspaceAbility, ability);

      expect(service.workspaceCan("read", Subject)).toBe(true);
      expect(service.workspaceCan("update", Subject)).toBe(false);
    });
  });

  it("verifies current user, session, workspace, and member identities", async () => {
    const currentUser = Object.assign(new TestUser(), { id: "user-1" });
    const currentSession = Object.assign(new TestSession(), {
      token: "session-1",
    });
    const currentWorkspace = Object.assign(new TestWorkspace(), {
      id: "workspace-1",
    });
    const currentMember = Object.assign(new TestWorkspaceMember(), {
      id: "member-1",
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseUser, currentUser);
      RequestContext.set(BaseSession, currentSession);
      RequestContext.set(BaseWorkspace, currentWorkspace);
      RequestContext.set(BaseWorkspaceMember, currentMember);

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
        service.assertCurrentWorkspaceMember(currentMember);
      }).not.toThrow();
      expect(() => {
        service.assertCurrentUser(
          Object.assign(new TestUser(), { id: "user-2" }),
        );
      }).toThrow(ForbiddenException);
      expect(() => {
        service.assertCurrentSession(
          Object.assign(new TestSession(), { token: "session-2" }),
        );
      }).toThrow(ForbiddenException);
      expect(() => {
        service.assertCurrentWorkspace(
          Object.assign(new TestWorkspace(), { id: "workspace-2" }),
        );
      }).toThrow(ForbiddenException);
      expect(() => {
        service.assertCurrentWorkspaceMember(
          Object.assign(new TestWorkspaceMember(), { id: "member-2" }),
        );
      }).toThrow(ForbiddenException);
    });
  });

  it("prevents workspace grants from exceeding the current principal", async () => {
    const ceilingService = new AccessControlService({
      ...options,
      workspace: {
        defaultRole: "member",
        permissions: ["Post:read", "Post:update", "Post:delete"],
        roles: {
          member: ["Post:read", "Post:update"],
        },
      },
    });
    const user = new TestUser();
    const member = Object.assign(new TestWorkspaceMember(), {
      permissions: [],
      roles: ["member"],
    });
    const userApiKey = Object.assign(new TestApiKey(), {
      owner: user as BaseApiKey["owner"],
      permissions: ["Post:read"],
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseWorkspaceMember, member);

      expect(() => {
        ceilingService.assertCanGrantWorkspacePermissions(["Post:update"]);
      }).not.toThrow();

      RequestContext.set(BaseApiKey, userApiKey);
      expect(() => {
        ceilingService.assertCanGrantWorkspacePermissions(["Post:read"]);
      }).not.toThrow();
      expect(() => {
        ceilingService.assertCanGrantWorkspacePermissions(["Post:update"]);
      }).toThrow(
        "Workspace permissions exceed issuer permissions: Post:update",
      );
    });
  });

  it("uses a workspace API key's permissions as its grant ceiling", async () => {
    const workspace = new TestWorkspace();
    const apiKey = Object.assign(new TestApiKey(), {
      owner: workspace as BaseApiKey["owner"],
      permissions: ["Post:read"],
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseApiKey, apiKey);

      expect(() => {
        service.assertCanGrantWorkspacePermissions(["Post:read"]);
      }).not.toThrow();
      expect(() => {
        service.assertCanGrantWorkspacePermissions(["Post:delete"]);
      }).toThrow(
        "Workspace permissions exceed issuer permissions: Post:delete",
      );
    });
  });
});
