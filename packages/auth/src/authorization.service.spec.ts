import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { CURRENT_API_KEY, CURRENT_WORKSPACE_MEMBER } from "./auth.constants.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import { AuthorizationService } from "./authorization.service.js";
import {
  BaseApiKey,
  BaseSession,
  BaseUser,
  BaseWorkspace,
  BaseWorkspaceMember,
} from "./entities/index.js";
import {
  USER_PERMISSION_ABILITY,
  WORKSPACE_PERMISSION_ABILITY,
} from "./permission.constants.js";

class TestApiKey extends BaseApiKey {}
class TestSession extends BaseSession {}
class TestUser extends BaseUser {}
class TestWorkspace extends BaseWorkspace {}
class TestWorkspaceMember extends BaseWorkspaceMember {}
class Subject {}

describe("AuthorizationService", () => {
  const options = {
    entities: {
      user: TestUser,
      workspace: TestWorkspace,
    },
  } as AuthModuleOptions;
  const service = new AuthorizationService(options);

  it("checks the cached user ability", async () => {
    const user = Object.assign(new TestUser(), { id: "user-1" });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseUser, user);
      RequestContext.set(USER_PERMISSION_ABILITY, {
        can: vi.fn().mockReturnValue(true),
      } as never);

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
      permissions: ["subject:read"],
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseUser, user);
      RequestContext.set(CURRENT_API_KEY, apiKey);
      RequestContext.set(USER_PERMISSION_ABILITY, {
        can: vi.fn().mockReturnValue(true),
      } as never);

      expect(service.userCan("read", Subject)).toBe(true);
      expect(service.userCan("update", Subject)).toBe(false);
    });
  });

  it("allows workspace keys only through their explicit permissions", async () => {
    const workspace = new TestWorkspace();
    const apiKey = Object.assign(new TestApiKey(), {
      owner: workspace as BaseApiKey["owner"],
      permissions: ["subject:read"],
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(CURRENT_API_KEY, apiKey);

      expect(service.workspaceCan("read", Subject)).toBe(true);
      expect(service.workspaceCan("update", Subject)).toBe(false);
      expect(service.userCan("read", Subject)).toBe(false);
    });
  });

  it("requires a membership and ability for workspace session access", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(CURRENT_WORKSPACE_MEMBER, new TestWorkspaceMember());
      RequestContext.set(WORKSPACE_PERMISSION_ABILITY, {
        can: vi.fn().mockImplementation((action) => action === "read"),
      } as never);

      expect(service.workspaceCan("read", Subject)).toBe(true);
      expect(service.workspaceCan("update", Subject)).toBe(false);
    });
  });

  it("verifies current user, session, and workspace-member identities", async () => {
    const currentUser = Object.assign(new TestUser(), { id: "user-1" });
    const currentSession = Object.assign(new TestSession(), {
      token: "session-1",
    });
    const currentMember = Object.assign(new TestWorkspaceMember(), {
      id: "member-1",
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseUser, currentUser);
      RequestContext.set(BaseSession, currentSession);
      RequestContext.set(CURRENT_WORKSPACE_MEMBER, currentMember);

      expect(() => {
        service.assertCurrentUser(currentUser);
      }).not.toThrow();
      expect(() => {
        service.assertCurrentSession(currentSession);
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
        service.assertCurrentWorkspaceMember(
          Object.assign(new TestWorkspaceMember(), { id: "member-2" }),
        );
      }).toThrow(ForbiddenException);
    });
  });
});
