/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager } from "@mikro-orm/core";
import { HashService } from "@nest-boot/hash";
import { RequestContext } from "@nest-boot/request-context";
import type { Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { withAuthTestFeatures } from "../../test/fixtures/enabled-auth-features.fixture.js";
import { mockAuthorization } from "../../test/mock-authorization.js";
import {
  createTestWorkspace,
  createTestWorkspaceMember,
  createWorkspaceServices,
} from "../../test/workspace-service.fixture.js";
import { ApiKey } from "../api-key/entities/api-key.entity.js";
import { UserApiKey } from "../api-key/objects/user-api-key.object.js";
import { ApiKeyAuthenticationService } from "../api-key/services/api-key-authentication.service.js";
import { AuthAbility } from "../common/auth.ability.js";
import { Workspace } from "../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../workspace/entities/workspace-member.entity.js";
import { WorkspaceService } from "../workspace/services/workspace.service.js";
import { WorkspaceInvitationService } from "../workspace/services/workspace-invitation.service.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import { AuthContext } from "./auth-context.js";
import { authServiceProviders } from "./auth-service.providers.js";
import { AUTH_TOKEN } from "./constants/auth.constants.js";
import { Session } from "./entities/session.entity.js";
import { User } from "./entities/user.entity.js";
import type { AuthModuleOptions } from "./interfaces/auth-module-options.interface.js";
import { UserService } from "./services/user.service.js";
import { UserDeletionService } from "./services/user-deletion.service.js";

describe("auth service execution boundaries", () => {
  it("isolates credential lookup but records usage through the caller's scoped manager", async () => {
    const { em } = createWorkspaceServices();
    const { em: isolated } = createWorkspaceServices();
    Object.assign(isolated, { clearSessionContext: vi.fn() });
    em.fork.mockReturnValue(isolated);
    const session = {
      role: "authenticated",
      variables: { "app.auth.user.id": "user-1" },
    };
    em.getSessionContext.mockReturnValue(session);
    const user = Object.assign(new User(), { id: "user-1" });
    const apiKey = Object.assign(new UserApiKey(new ApiKey()), {
      id: "key-1",
      user,
      revokedAt: null,
    });
    isolated.findOne.mockResolvedValueOnce(apiKey).mockResolvedValueOnce(user);
    const type = ApiKeyAuthenticationService;
    const service = await createProvider(
      type,
      em,
      withAuthTestFeatures({
        workspace: { enabled: true },
      }),
    );
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(EntityManager, em);
      await expect(service.validate("credential")).resolves.toMatchObject({
        apiKey,
        ownerType: "user",
        user,
      });
      await service.recordUsage(apiKey);
      expect(isolated.clearSessionContext).toHaveBeenCalledOnce();
      expect(isolated.findOne).toHaveBeenCalledTimes(2);
      expect(em.findOne).not.toHaveBeenCalled();
      expect(isolated.nativeUpdate).not.toHaveBeenCalled();
      expect(em.nativeUpdate).toHaveBeenCalledExactlyOnceWith(
        ApiKey,
        { id: apiKey.id, ownerType: "user" },
        { lastUsedAt: expect.any(Date), updatedAt: expect.any(Date) },
      );
      expect(RequestContext.get(EntityManager)).toBe(em);
      expect(em.getSessionContext()).toBe(session);
      expect(em.setSessionContext).not.toHaveBeenCalled();
    });
  });

  it.each(["missing", "banned", "failure"] as const)(
    "publishes terminal impersonation revocation to the parent request (%s)",
    async (state) => {
      const { em } = createWorkspaceServices();
      const { em: isolated } = createWorkspaceServices();
      Object.assign(isolated, { clearSessionContext: vi.fn() });
      em.fork.mockReturnValue(isolated);
      em.getSessionContext.mockReturnValue({
        role: "authenticated",
        variables: {
          "app.auth.user.id": "target",
          "app.auth.workspace.id": "workspace-1",
          "app.selected.workspace.id": "workspace-1",
        },
      });
      const user = Object.assign(new User(), { id: "target" });
      const administrator = Object.assign(new User(), {
        id: "admin",
        banned: true,
      });
      const session = Object.assign(new Session(), {
        user,
        impersonatedBy: administrator,
      });
      isolated.findOne.mockResolvedValue(
        state === "missing" ? null : administrator,
      );
      if (state === "failure") {
        isolated.flush.mockRejectedValueOnce(new Error("Commit failed"));
      }
      const type = UserService;
      const service = await createProvider(type, em, {});
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(EntityManager, em);
          RequestContext.set(User, user);
          RequestContext.set(Session, session);
          RequestContext.set(Workspace, createTestWorkspace());
          RequestContext.set(WorkspaceMember, createTestWorkspaceMember());
          const ability = new AuthAbility([
            { action: "update", subject: User },
          ]);
          RequestContext.set(AuthAbility, ability);
          const result = service.stopImpersonating(session);
          if (state === "missing") {
            await expect(result).resolves.toBeNull();
          } else {
            await expect(result).rejects.toThrow(
              state === "banned"
                ? "Banned administrators cannot restore their session"
                : "Commit failed",
            );
          }
          expect(RequestContext.get(EntityManager)).toBe(em);
          if (state === "failure") {
            expect(RequestContext.get(User)).toBe(user);
            expect(RequestContext.get(Session)).toBe(session);
            expect(RequestContext.get(AuthAbility)).toBe(ability);
            expect(em.setSessionContext).not.toHaveBeenCalled();
          } else {
            for (const token of [User, Session, WorkspaceMember]) {
              expect(RequestContext.get(token)).toBeNull();
            }
            expect(RequestContext.get(AuthAbility)?.can("update", User)).toBe(
              false,
            );
            expect(em.setSessionContext).toHaveBeenCalledWith({
              role: "anonymous",
              variables: {
                "app.auth.user.id": "",
                "app.auth.workspace.id": "",
                "app.selected.workspace.id": RequestContext.get(Workspace)?.id,
                "app.auth.workspace_member.id": "",
              },
            });
          }
        },
      );
    },
  );

  it.each([false, true])(
    "keeps deletion on the request manager and clears authorization only after commit (failure=%s)",
    async (failure) => {
      const { em } = createWorkspaceServices();
      em.getSessionContext.mockReturnValue({
        role: "authenticated",
        variables: { "app.auth.workspace.id": "workspace-1" },
      });
      const workspace = createTestWorkspace();
      const member = createTestWorkspaceMember();
      const ability = new AuthAbility([
        { action: "delete", subject: Workspace },
      ]);
      if (failure) {
        em.transactional.mockRejectedValueOnce(new Error("Commit failed"));
      }
      const type = WorkspaceService;
      const service = await createProvider(type, em, {
        workspace: { enabled: true },
      });
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(EntityManager, em);
          RequestContext.set(WorkspaceMember, member);
          RequestContext.set(Workspace, workspace);
          RequestContext.set(AuthAbility, ability);
          const result = service.deleteWorkspace(workspace);
          if (failure) {
            await expect(result).rejects.toThrow("Commit failed");
          } else {
            await expect(result).resolves.toBe(workspace);
          }
          expect(RequestContext.get(EntityManager)).toBe(em);
          expect(em.fork).not.toHaveBeenCalled();
          expect(RequestContext.get(WorkspaceMember)).toBe(
            failure ? member : null,
          );
          expect(RequestContext.get(Workspace)).toBe(
            failure ? workspace : null,
          );
          expect(
            RequestContext.get(AuthAbility)?.can("delete", Workspace),
          ).toBe(failure);
          if (failure) {
            expect(em.setSessionContext).not.toHaveBeenCalled();
          } else {
            expect(em.setSessionContext).toHaveBeenCalledWith(
              expect.objectContaining({
                variables: expect.objectContaining({
                  "app.auth.workspace.id": "",
                }),
              }),
            );
          }
        },
      );
    },
  );

  it.each([false, true])(
    "isolates the read-only invitation identity lookup inside an RLS transaction (failure=%s)",
    async (failure) => {
      const type = WorkspaceInvitationService;
      const execute = vi.fn().mockResolvedValue([{ role: "authenticated" }]);
      const transaction = {};
      const reader = {
        getConnection: () => ({ execute }),
        getTransactionContext: () => transaction,
        clearSessionContext: vi.fn(),
        transactional: vi.fn(
          async (callback: (em: unknown) => Promise<unknown>) =>
            await callback(reader),
        ),
        findOne: failure
          ? vi.fn().mockRejectedValue(new Error("Lookup failed"))
          : vi.fn().mockResolvedValue({ id: "user-1" }),
      };
      const current = {
        getContext: vi.fn().mockReturnThis(),
        isInTransaction: vi.fn(() => true),
        getSessionContext: vi.fn(() => ({ role: "authenticated" })),
        fork: vi.fn(() => reader),
        clearSessionContext: vi.fn(),
      } as unknown as EntityManager;
      mockAuthorization();
      const service = await createProvider(type, current, {
        workspace: { enabled: true },
      });
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(EntityManager, current);
          const result = service.getUserIdForWorkspaceInvitation(
            new Workspace(),
            new User(),
            "user@example.com",
          );
          if (failure) {
            await expect(result).rejects.toThrow("Lookup failed");
          } else {
            await expect(result).resolves.toBe("user-1");
          }
          expect(RequestContext.get(EntityManager)).toBe(current);
        },
      );
      expect(current.fork).toHaveBeenCalledWith({
        useContext: false,
        keepTransactionContext: true,
      });
      expect(current.clearSessionContext).not.toHaveBeenCalled();
      expect(reader.transactional).toHaveBeenCalledWith(expect.any(Function));
      expect(execute).toHaveBeenCalledWith(
        "set local role none",
        [],
        "run",
        transaction,
      );
      if (!failure) {
        expect(execute).toHaveBeenLastCalledWith(
          'set local role "authenticated"',
          [],
          "run",
          transaction,
        );
      }
      expect(reader.findOne).toHaveBeenCalledWith(
        User,
        { email: "user@example.com" },
        { fields: ["id"], filters: false },
      );
    },
  );
});

/**
 *
 * @param type - Nest provider token to resolve.
 * @param em - Entity manager for this persistence boundary.
 * @param options - Authentication module configuration.
 * @returns Result of the requested operation.
 */
async function createProvider<T>(
  type: Type<T>,
  em: EntityManager,
  options: AuthModuleOptions,
): Promise<T> {
  const module = await Test.createTestingModule({
    providers: [
      ...authServiceProviders,
      AuthContext,
      { provide: EntityManager, useValue: em },
      { provide: MODULE_OPTIONS_TOKEN, useValue: options },
      { provide: AUTH_TOKEN, useValue: {} },
      { provide: HashService, useValue: {} },
      { provide: UserDeletionService, useValue: {} },
    ],
  }).compile();
  return await module.get(type);
}
