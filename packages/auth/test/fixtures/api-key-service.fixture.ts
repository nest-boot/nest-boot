import { EntityManager, ref } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { it as baseIt, type Mocked } from "vitest";

import { WorkspaceApiKey } from "../../src/api-key/entities/workspace-api-key.entity.js";
import { UserApiKeyService } from "../../src/api-key/services/user-api-key.service.js";
import { WorkspaceApiKeyService } from "../../src/api-key/services/workspace-api-key.service.js";
import * as abilityHelpers from "../../src/common/utils/authorize.util.js";
import { User } from "../../src/core/entities/user.entity.js";
import { RequestIdentity } from "../../src/core/infrastructure/request-identity.js";
import type { AuthModuleOptions } from "../../src/core/interfaces/auth-module-options.interface.js";
import { Member } from "../../src/workspace/entities/member.entity.js";
import { Workspace } from "../../src/workspace/entities/workspace.entity.js";
import { withAuthTestFeatures } from "./enabled-auth-features.fixture.js";
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
export function createTestApiKey(): WorkspaceApiKey {
  return Object.assign(new WorkspaceApiKey(), {
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
    populate: vi.fn().mockImplementation((entity) => Promise.resolve(entity)),
    createQueryBuilder: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      toRaw: vi.fn().mockReturnValue("member-query"),
    })),
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
  const userService = new UserApiKeyService(em, withAuthTestFeatures(options));
  const workspaceService = new WorkspaceApiKeyService(
    em,
    withAuthTestFeatures(options),
  );
  return {
    authorization,
    em,
    service: {
      getUserApiKeyPermissions:
        userService.getUserApiKeyPermissions.bind(userService),
      getWorkspaceApiKeyPermissions:
        workspaceService.getWorkspaceApiKeyPermissions.bind(workspaceService),
      getUserApiKey: userService.getUserApiKey.bind(userService),
      getWorkspaceApiKey:
        workspaceService.getWorkspaceApiKey.bind(workspaceService),
      getUserApiKeyConnection:
        userService.getUserApiKeyConnection.bind(userService),
      getWorkspaceApiKeyConnection:
        workspaceService.getWorkspaceApiKeyConnection.bind(workspaceService),
      createUserApiKey: userService.createUserApiKey.bind(userService),
      createWorkspaceApiKey:
        workspaceService.createWorkspaceApiKey.bind(workspaceService),
      updateUserApiKey: userService.updateUserApiKey.bind(userService),
      updateWorkspaceApiKey:
        workspaceService.updateWorkspaceApiKey.bind(workspaceService),
      deleteUserApiKey: userService.deleteUserApiKey.bind(userService),
      deleteWorkspaceApiKey:
        workspaceService.deleteWorkspaceApiKey.bind(workspaceService),
    },
  };
}
