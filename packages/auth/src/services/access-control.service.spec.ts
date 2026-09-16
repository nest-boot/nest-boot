import { subject as caslSubject } from "@casl/ability";
import { ref } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { ApiKey as BaseApiKey } from "../entities/api-key.entity.js";
import { Member as BaseMember } from "../entities/member.entity.js";
import { Session as BaseSession } from "../entities/session.entity.js";
import {
  User as BaseUser,
  User as UserEntity,
} from "../entities/user.entity.js";
import {
  Workspace as BaseWorkspace,
  Workspace as WorkspaceEntity,
} from "../entities/workspace.entity.js";
import { AccessControlService } from "./access-control.service.js";

const TestApiKey = BaseApiKey;
type TestApiKey = BaseApiKey;
const TestSession = BaseSession;
type TestSession = BaseSession;
const TestUser = BaseUser;
type TestUser = BaseUser;
const TestWorkspace = BaseWorkspace;
type TestWorkspace = BaseWorkspace;
const TestMember = BaseMember;
type TestMember = BaseMember;
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

  it.each(["missing", "both"])("rejects %s API-key ownership", (kind) => {
    const apiKey = new TestApiKey();
    if (kind === "both") {
      apiKey.user = ref(UserEntity, new TestUser());
      apiKey.workspace = ref(WorkspaceEntity, new TestWorkspace());
    }
    expect(() => {
      service.assertApiKeyOwner(apiKey);
    }).toThrow(ForbiddenException);
  });

  it("intersects user API-key permissions with the user ability", async () => {
    const user = new TestUser();
    const apiKey = Object.assign(new TestApiKey(), {
      workspace: null,
      user: ref(UserEntity, user),
      permissions: ["subject:read"],
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
      workspace: ref(WorkspaceEntity, workspace),
      permissions: ["subject:read"],
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
      workspace: ref(WorkspaceEntity, workspace),
      permissions: ["post:read"],
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
      workspace: ref(WorkspaceEntity, workspace),
      permissions: ["subject:read"],
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseApiKey, apiKey);
      RequestContext.set(WorkspaceAbility, new WorkspaceAbility());

      expect(service.workspaceCan("read", Subject)).toBe(false);
    });
  });

  it("requires a membership and ability for workspace session access", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseMember, new TestMember());
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
    const currentMember = Object.assign(new TestMember(), {
      id: "member-1",
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseUser, currentUser);
      RequestContext.set(BaseSession, currentSession);
      RequestContext.set(BaseWorkspace, currentWorkspace);
      RequestContext.set(BaseMember, currentMember);

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
        service.assertCurrentMember(
          Object.assign(new TestMember(), { id: "member-2" }),
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
    const user = Object.assign(new TestUser(), {
      roles: ["reader"],
      permissions: ["user:set-role"],
    });
    expect(() => {
      ceilingService.assertCanGrantUserPermissions(["user:get"]);
    }).toThrow(ForbiddenException);
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseUser, user);
      expect(() => {
        ceilingService.assertCanGrantUserPermissions([
          "user:get",
          "user:set-role",
        ]);
      }).not.toThrow();
      expect(() => {
        ceilingService.assertCanGrantUserPermissions(["user:delete"]);
      }).toThrow("User permissions exceed issuer permissions: user:delete");
      RequestContext.set(
        BaseApiKey,
        Object.assign(new TestApiKey(), {
          workspace: null,
          user: user,
          permissions: ["user:get", "user:delete"],
        }),
      );
      expect(() => {
        ceilingService.assertCanGrantUserPermissions(["user:get"]);
      }).not.toThrow();
      expect(() => {
        ceilingService.assertCanGrantUserPermissions(["user:set-role"]);
      }).toThrow(ForbiddenException);
      expect(() => {
        ceilingService.assertCanGrantUserPermissions(["user:delete"]);
      }).toThrow(ForbiddenException);
      RequestContext.set(
        BaseApiKey,
        Object.assign(new TestApiKey(), {
          workspace: new TestWorkspace(),
          permissions: ["user:get"],
        }),
      );
      expect(() => {
        ceilingService.assertCanGrantUserPermissions(["user:get"]);
      }).toThrow(ForbiddenException);
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
    const user = new TestUser();
    const member = Object.assign(new TestMember(), {
      permissions: [],
      roles: ["member"],
    });
    const userApiKey = Object.assign(new TestApiKey(), {
      workspace: null,
      user: ref(UserEntity, user),
      permissions: ["post:read"],
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseMember, member);

      expect(() => {
        ceilingService.assertCanGrantWorkspacePermissions(["post:update"]);
      }).not.toThrow();

      RequestContext.set(BaseApiKey, userApiKey);
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
    const workspace = new TestWorkspace();
    const apiKey = Object.assign(new TestApiKey(), {
      workspace: ref(WorkspaceEntity, workspace),
      permissions: ["post:read"],
    });

    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(BaseApiKey, apiKey);

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
