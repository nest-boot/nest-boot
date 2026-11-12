import { EntityManager } from "@mikro-orm/core";
import type { Mocked } from "vitest";

import { User } from "../src/core/entities/user.entity.js";
import type { AuthModuleOptions } from "../src/core/interfaces/auth-module-options.interface.js";
import { Workspace } from "../src/workspace/entities/workspace.entity.js";
import { WorkspaceInvitation } from "../src/workspace/entities/workspace-invitation.entity.js";
import { WorkspaceMember } from "../src/workspace/entities/workspace-member.entity.js";
import { WorkspaceService } from "../src/workspace/services/workspace.service.js";
import { WorkspaceInvitationService } from "../src/workspace/services/workspace-invitation.service.js";
import { WorkspaceMemberService } from "../src/workspace/services/workspace-member.service.js";
import { mockAuthorization } from "./mock-authorization.js";
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
 * Returns member fixture with deterministic identifiers.
 * @returns WorkspaceMember fixture with deterministic identifiers.
 */
export function createTestWorkspaceMember(): WorkspaceMember {
  return Object.assign(new WorkspaceMember(), {
    id: "member-1",
    roles: ["member"],
    status: "ACTIVE" as const,
    workspace: {
      id: "workspace-1",
    } as WorkspaceMember["workspace"],
  });
}
/**
 * Returns user fixture with deterministic identifiers.
 * @returns User fixture with deterministic identifiers.
 */
export function createTestUser(): User {
  return new User();
}
/**
 * Returns invitation fixture with deterministic identifiers.
 * @returns WorkspaceInvitation fixture with deterministic identifiers.
 */
export function createTestWorkspaceInvitation(): WorkspaceInvitation {
  return Object.assign(new WorkspaceInvitation(), {
    id: "invitation-1",
    workspace: {
      id: "workspace-1",
    } as WorkspaceInvitation["workspace"],
  });
}
/**
 * Returns workspace and member services with their persistence and authorization mocks.
 * @param workspace - Workspace role and permission configuration for the fixture.
 * @returns Workspace and member services with their persistence and authorization mocks.
 */
export function createWorkspaceServices(
  workspace: NonNullable<AuthModuleOptions["workspace"]> &
    Pick<AuthModuleOptions, "buildAbility"> = {},
) {
  const em = {
    setSessionContext: vi.fn(),
    getContext: vi.fn().mockReturnThis(),
    getSessionContext:
      vi.fn<() => import("@mikro-orm/core").SessionContext | undefined>(),
    isInTransaction: vi.fn(() => false),
    fork: vi.fn(),
    assign: vi.fn((entity, data) => Object.assign(entity, data)),
    create: vi.fn((Entity, data) => Object.assign(new Entity(), data)),
    find: vi.fn(),
    findOne: vi.fn(),
    populate: vi.fn().mockImplementation((entity) => Promise.resolve(entity)),
    flush: vi.fn(),
    lock: vi.fn(),
    nativeUpdate: vi.fn(),
    nativeDelete: vi.fn(),
    persist: vi.fn(),
    refreshOrFail: vi.fn((entity) => Promise.resolve(entity)),
    remove: vi.fn(),
    transactional: vi.fn(),
  } as unknown as Mocked<EntityManager>;
  em.persist.mockReturnValue(em);
  em.remove.mockReturnValue(em);
  em.nativeUpdate.mockResolvedValue(1);
  em.nativeDelete.mockResolvedValue(1);
  em.transactional.mockImplementation(async (callback) => await callback(em));
  const options = {
    workspace: { ...workspace, enabled: true },
    buildAbility: workspace.buildAbility,
  } as unknown as AuthModuleOptions;
  const authorization = mockAuthorization();
  return {
    authorization,
    em,
    workspaceService: new WorkspaceService(em, options),
    workspaceMemberService: new WorkspaceMemberService(em, options),
    workspaceInvitationService: new WorkspaceInvitationService(em, options),
  };
}
