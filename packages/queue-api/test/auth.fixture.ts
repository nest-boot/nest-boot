import type { EntityManager } from "@mikro-orm/core";
import { UserService, WorkspaceService } from "@nest-boot/auth";

/**
 * Creates real authorization helpers without starting authentication persistence.
 * @param em - Entity manager used by the subject under test.
 * @returns Auth services using the default role and permission catalog.
 */
export function createAuthServices(em: EntityManager = {} as EntityManager) {
  return {
    users: new UserService(
      em,
      {},
      {} as ConstructorParameters<typeof UserService>[2],
      { deleteUser: () => Promise.resolve(null) },
    ),
    workspaces: new WorkspaceService(em, {}),
  };
}

/**
 * Supplies auth domain services to queue-only integration applications.
 * @param token - Missing dependency from the test module.
 * @returns Actual auth helper, or undefined for unrelated dependencies.
 */
export function mockAuthService(token: unknown) {
  const auth = createAuthServices();
  if (token === UserService) {
    return auth.users;
  }
  if (token === WorkspaceService) {
    return auth.workspaces;
  }
  return undefined;
}
