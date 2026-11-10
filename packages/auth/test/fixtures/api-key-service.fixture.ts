import { EntityManager, ref } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { it as baseIt, type Mocked } from "vitest";

import type { AuthModuleOptions } from "../../src/auth-module-options.interface.js";
import { Member } from "../../src/entities/member.entity.js";
import { MemberApiKey } from "../../src/entities/member-api-key.entity.js";
import { User } from "../../src/entities/user.entity.js";
import { Workspace } from "../../src/entities/workspace.entity.js";
import { RequestIdentity } from "../../src/infrastructure/request-identity.js";
import { MemberApiKeyService } from "../../src/services/member-api-key.service.js";
import { UserApiKeyService } from "../../src/services/user-api-key.service.js";
import * as abilityHelpers from "../../src/utils/authorize.util.js";
/**
 * Returns workspace fixture with deterministic identifiers.
 * @returns Workspace fixture with deterministic identifiers.
 */
export function createTestWorkspace(): Workspace {
  return Object.assign(new Workspace(), {
    id: "workspace-1",
    name: "Acme",
  });
}

/**
 * Returns user fixture with deterministic identifiers.
 * @returns User fixture with deterministic identifiers.
 */
export function createTestUser(): User {
  return Object.assign(new User(), {
    id: "user-1",
    name: "Alice",
    email: "alice@example.com",
    emailVerified: true,
  });
}

/**
 * Returns member fixture with deterministic identifiers.
 * @returns Member fixture with deterministic identifiers.
 */
export function createTestMember(): Member {
  return Object.assign(new Member(), {
    id: "member-1",
    roles: ["owner"],
    status: "ACTIVE",
    user: ref(User, createTestUser()),
    permissions: [],
    workspace: {
      id: "workspace-1",
    } as Member["workspace"],
  });
}

/**
 * Returns api key fixture with deterministic identifiers.
 * @returns Api key fixture with deterministic identifiers.
 */
export function createTestApiKey(): MemberApiKey {
  return Object.assign(new MemberApiKey(), {
    id: "api-key-1",
    name: "Deploy key",
    start: "sk012345",
    prefix: "sk",
    key: "hashed-key",
    enabled: true,
    permissions: [],
    updatedAt: new Date(),
    lastUsedAt: null,
    expiresAt: null,
    member: ref(Member, createTestMember()),
  });
}

/**
 * Runs an API key service test within an isolated request context.
 * @param name - Name used to identify the resource.
 * @param callback - Work to execute in the supplied context.
 */
export function apiKeyTest(
  name: string,
  callback: () => void | Promise<void>,
): void {
  baseIt(name, async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(User, createTestUser());
      RequestContext.set(Workspace, createTestWorkspace());
      RequestContext.set(Member, createTestMember());
      await callback();
    });
  });
}

/**
 * Returns test service and its mocked dependencies.
 * @param configuration - Authentication configuration used by the fixture.
 * @returns Test service and its mocked dependencies.
 */
export function createService(
  configuration: Pick<
    AuthModuleOptions,
    "apiKey" | "user" | "workspace" | "buildAbility"
  > = {},
) {
  const em = {
    setSessionContext: vi.fn(),
    getContext: vi.fn().mockReturnThis(),
    getSessionContext:
      vi.fn<() => import("@mikro-orm/core").SessionContext | undefined>(),
    isInTransaction: vi.fn(() => false),
    fork: vi.fn(),
    create: vi.fn((_entity, data) => Object.assign(new _entity(), data)),
    findOne: vi.fn(),
    nativeUpdate: vi.fn().mockResolvedValue(1),
    transactional: vi.fn(),
    flush: vi.fn(),
    persist: vi.fn(),
    remove: vi.fn().mockReturnThis(),
  } as unknown as Mocked<EntityManager>;
  em.persist.mockReturnValue(em);
  em.transactional.mockImplementation(async (callback) => await callback(em));
  const options = {
    ...configuration,
    workspace: { ...configuration.workspace, enabled: true },
  } as unknown as AuthModuleOptions;
  const authorization = {
    assertCurrentUser: vi
      .spyOn(RequestIdentity, "assertCurrentUser")
      .mockImplementation(vi.fn()),
    assertCurrentMember: vi.spyOn(RequestIdentity, "assertCurrentMember"),
    assertCurrentWorkspace: vi.spyOn(RequestIdentity, "assertCurrentWorkspace"),
    authorize: vi
      .spyOn(abilityHelpers, "authorize")
      .mockImplementation(vi.fn()),
  };
  const userService = new UserApiKeyService(em, options);
  const workspaceService = new MemberApiKeyService(em, options);
  return {
    authorization,
    em,
    service: {
      getUserApiKeyPermissions:
        userService.getUserApiKeyPermissions.bind(userService),
      getMemberApiKeyPermissions:
        workspaceService.getMemberApiKeyPermissions.bind(workspaceService),
      getUserApiKey: userService.getUserApiKey.bind(userService),
      getMemberApiKey: workspaceService.getMemberApiKey.bind(workspaceService),
      getUserApiKeyConnection:
        userService.getUserApiKeyConnection.bind(userService),
      getMemberApiKeyConnection:
        workspaceService.getMemberApiKeyConnection.bind(workspaceService),
      createUserApiKey: userService.createUserApiKey.bind(userService),
      createMemberApiKey:
        workspaceService.createMemberApiKey.bind(workspaceService),
      updateUserApiKey: userService.updateUserApiKey.bind(userService),
      updateMemberApiKey:
        workspaceService.updateMemberApiKey.bind(workspaceService),
      deleteUserApiKey: userService.deleteUserApiKey.bind(userService),
      deleteMemberApiKey:
        workspaceService.deleteMemberApiKey.bind(workspaceService),
    },
  };
}
