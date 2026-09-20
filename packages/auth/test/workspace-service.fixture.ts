import { EntityManager } from "@mikro-orm/core";
import type { Mocked } from "vitest";

import type { AuthModuleOptions } from "../src/auth-module-options.interface.js";
import { Invitation, Member, User, Workspace } from "../src/entities/index.js";
import { InvitationService } from "../src/services/invitation.service.js";
import { MemberService } from "../src/services/member.service.js";
import { WorkspaceService } from "../src/services/workspace.service.js";
import { mockAuthorization } from "./mock-authorization.js";
export function createTestWorkspace(): Workspace {
  return Object.assign(new Workspace(), {
    id: "workspace-1",
    name: "Acme",
  });
}
export function createTestMember(): Member {
  return Object.assign(new Member(), {
    id: "member-1",
    roles: ["member"],
    status: "ACTIVE" as const,
    workspace: {
      id: "workspace-1",
    } as Member["workspace"],
  });
}
export function createTestUser(): User {
  return new User();
}
export function createTestInvitation(): Invitation {
  return Object.assign(new Invitation(), {
    id: "invitation-1",
    workspace: {
      id: "workspace-1",
    } as Invitation["workspace"],
  });
}
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
    workspace,
    buildAbility: workspace.buildAbility,
  } as unknown as AuthModuleOptions;
  const authorization = mockAuthorization();
  return {
    authorization,
    em,
    workspaceService: new WorkspaceService(em, options),
    memberService: new MemberService(em, options),
    invitationService: new InvitationService(em, options),
  };
}
