import type { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { vi } from "vitest";

import { ApiKeyService } from "../../src/api-key/services/api-key.service.js";
import { AuthAbility } from "../../src/common/auth.ability.js";
import { invalidateRequestPermissions } from "../../src/common/utils/resolve-request-permissions.util.js";
import { AuthContext } from "../../src/core/auth-context.js";
import { AuthTransactionSubscriber } from "../../src/core/auth-transaction.subscriber.js";
import { API_KEY } from "../../src/core/constants/auth.constants.js";
import { Session } from "../../src/core/entities/session.entity.js";
import { User } from "../../src/core/entities/user.entity.js";
import type { AuthContextPatch } from "../../src/core/interfaces/auth-context-patch.interface.js";
import type { AuthModuleOptions } from "../../src/core/interfaces/auth-module-options.interface.js";
import { Workspace } from "../../src/workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../src/workspace/entities/workspace-member.entity.js";
/**
 * Constructs the real provider with a native manager or the fixture's persistence mock.
 * @param em - Entity manager for this persistence boundary.
 * @param options - Authentication module configuration.
 * @returns Result of the requested operation.
 */
export function createTestAuthContext(
  em?: unknown,
  options: unknown = {},
): AuthContext {
  const manager = (em ?? {
    getSessionContext: vi.fn(),
    setSessionContext: vi.fn(),
  }) as EntityManager;
  if (!manager.getTransactionContext) {
    Object.assign(manager, { getTransactionContext: vi.fn() });
  }
  const transactions = new AuthTransactionSubscriber(manager);
  const context = new AuthContext(
    manager,
    options as AuthModuleOptions,
    transactions,
  );
  if (typeof manager.getEventManager === "function") {
    transactions.onModuleInit();
  }
  return context;
}
/**
 * Constructs shared credential persistence with its real context dependency.
 * @param em - Entity manager for this persistence boundary.
 * @param options - Authentication module configuration.
 * @returns Result of the requested operation.
 */
export function createTestApiKeyService(
  em: EntityManager,
  options: AuthModuleOptions = {},
): ApiKeyService {
  return new ApiKeyService(em, createTestAuthContext(em, options));
}
/**
 * Stages fixture identities without issuing database session changes.
 * @param patch - Identity values to stage for this test.
 */
export function stageIdentity(patch: AuthContextPatch): void {
  if (!RequestContext.isActive()) {
    return;
  }
  if ("user" in patch) {
    RequestContext.set(User, patch.user ?? null);
  }
  if ("session" in patch) {
    RequestContext.set(Session, patch.session ?? null);
  }
  if ("workspace" in patch) {
    RequestContext.set(Workspace, patch.workspace ?? null);
  }
  if ("member" in patch) {
    RequestContext.set(WorkspaceMember, patch.member ?? null);
  }
  if ("apiKey" in patch) {
    RequestContext.set(API_KEY, patch.apiKey ?? null);
  }
  invalidateRequestPermissions();
  RequestContext.set(AuthAbility, null);
}
