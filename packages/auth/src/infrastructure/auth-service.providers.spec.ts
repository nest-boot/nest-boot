/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import type { FactoryProvider } from "@nestjs/common";

import { mockAuthorization } from "../../test/mock-authorization.js";
import {
  createTestMember,
  createTestWorkspace,
  createWorkspaceServices,
} from "../../test/workspace-service.fixture.js";
import { AuthAbility } from "../abilities/auth.ability.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Member } from "../entities/member.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { InvitationService } from "../services/invitation.service.js";
import { MemberService } from "../services/member.service.js";
import { SessionService } from "../services/session.service.js";
import { UserService } from "../services/user.service.js";
import { WorkspaceService } from "../services/workspace.service.js";
import { ApiKeyAuthenticationService } from "./api-key-authentication.service.js";
import { authServiceProviders } from "./auth-service.providers.js";

describe("auth service execution boundaries", () => {
  it("isolates credential lookup but records usage through the caller's scoped manager", async () => {
    const { em } = createWorkspaceServices();
    const { em: isolated } = createWorkspaceServices();
    Object.assign(isolated, { clearSessionContext: vi.fn() });
    em.fork.mockReturnValue(isolated);
    const session = {
      role: "authenticated",
      variables: { "app.user.id": "user-1" },
    };
    em.getSessionContext.mockReturnValue(session);
    const user = Object.assign(new User(), { id: "user-1" });
    const apiKey = Object.assign(new UserApiKey(), {
      id: "key-1",
      user,
      enabled: true,
    });
    isolated.findOne.mockResolvedValueOnce(apiKey).mockResolvedValueOnce(null);
    const provider = authServiceProviders.find(
      (candidate) =>
        typeof candidate === "object" &&
        "provide" in candidate &&
        candidate.provide === ApiKeyAuthenticationService,
    ) as FactoryProvider<ApiKeyAuthenticationService>;
    const service = await provider.useFactory(em);
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
        UserApiKey,
        { id: apiKey.id },
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
          "app.user.id": "target",
          "app.workspace.id": "workspace-1",
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
      if (state === "failure")
        isolated.flush.mockRejectedValueOnce(new Error("Commit failed"));
      const provider = authServiceProviders.find(
        (candidate) =>
          typeof candidate === "object" &&
          "provide" in candidate &&
          candidate.provide === UserService,
      ) as FactoryProvider<UserService>;
      const service = await provider.useFactory(em, {}, {}, {});
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(EntityManager, em);
          RequestContext.set(User, user);
          RequestContext.set(Session, session);
          RequestContext.set(Workspace, createTestWorkspace());
          RequestContext.set(Member, createTestMember());
          const ability = new AuthAbility([
            { action: "update", subject: User },
          ]);
          RequestContext.set(AuthAbility, ability);
          const result = service.stopImpersonating(session);
          if (state === "missing") await expect(result).resolves.toBeNull();
          else
            await expect(result).rejects.toThrow(
              state === "banned"
                ? "Banned administrators cannot restore their session"
                : "Commit failed",
            );
          expect(RequestContext.get(EntityManager)).toBe(em);
          if (state === "failure") {
            expect(RequestContext.get(User)).toBe(user);
            expect(RequestContext.get(Session)).toBe(session);
            expect(RequestContext.get(AuthAbility)).toBe(ability);
            expect(em.setSessionContext).not.toHaveBeenCalled();
          } else {
            for (const token of [User, Session, Workspace, Member])
              expect(RequestContext.get(token)).toBeNull();
            expect(RequestContext.get(AuthAbility)?.can("update", User)).toBe(
              false,
            );
            expect(em.setSessionContext).toHaveBeenCalledWith({
              role: "anonymous",
              variables: { "app.user.id": "", "app.workspace.id": "" },
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
        variables: { "app.workspace.id": "workspace-1" },
      });
      const workspace = createTestWorkspace();
      const member = createTestMember();
      const ability = new AuthAbility([
        { action: "delete", subject: Workspace },
      ]);
      if (failure)
        em.transactional.mockRejectedValueOnce(new Error("Commit failed"));
      const provider = authServiceProviders.find(
        (candidate) =>
          typeof candidate === "object" &&
          "provide" in candidate &&
          candidate.provide === WorkspaceService,
      ) as FactoryProvider<WorkspaceService>;
      const service = await provider.useFactory(em, {});
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(EntityManager, em);
          RequestContext.set(Member, member);
          RequestContext.set(Workspace, workspace);
          RequestContext.set(AuthAbility, ability);
          const result = service.deleteWorkspace(workspace);
          if (failure) await expect(result).rejects.toThrow("Commit failed");
          else await expect(result).resolves.toBe(workspace);
          expect(RequestContext.get(EntityManager)).toBe(em);
          expect(em.fork).not.toHaveBeenCalled();
          expect(RequestContext.get(Member)).toBe(failure ? member : null);
          expect(RequestContext.get(Workspace)).toBe(
            failure ? workspace : null,
          );
          expect(
            RequestContext.get(AuthAbility)?.can("delete", Workspace),
          ).toBe(failure);
          if (failure) expect(em.setSessionContext).not.toHaveBeenCalled();
          else
            expect(em.setSessionContext).toHaveBeenCalledWith(
              expect.objectContaining({
                variables: expect.objectContaining({ "app.workspace.id": "" }),
              }),
            );
        },
      );
    },
  );

  it.each([false, true])(
    "isolates the read-only invitation identity lookup inside an RLS transaction (failure=%s)",
    async (failure) => {
      const provider = authServiceProviders.find(
        (candidate) =>
          typeof candidate === "object" &&
          "provide" in candidate &&
          candidate.provide === InvitationService,
      ) as FactoryProvider<InvitationService>;
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
        fork: vi.fn(() => reader),
        clearSessionContext: vi.fn(),
      } as unknown as EntityManager;
      mockAuthorization();
      const service = await provider.useFactory(current, {});
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(EntityManager, current);
          const result = service.getUserIdForInvitation(
            new Workspace(),
            new User(),
            "user@example.com",
          );
          if (failure) await expect(result).rejects.toThrow("Lookup failed");
          else await expect(result).resolves.toBe("user-1");
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
      if (!failure)
        expect(execute).toHaveBeenLastCalledWith(
          'set local role "authenticated"',
          [],
          "run",
          transaction,
        );
      expect(reader.findOne).toHaveBeenCalledWith(
        User,
        { email: "user@example.com" },
        { fields: ["id"], filters: false },
      );
    },
  );
  it("keeps ordinary session reads outside the privileged method allowlist", () => {
    const provider = authServiceProviders.find(
      (candidate) =>
        typeof candidate === "object" &&
        "provide" in candidate &&
        candidate.provide === SessionService,
    ) as FactoryProvider<SessionService>;
    mockAuthorization();
    const service = provider.useFactory({}, {} as EntityManager);
    for (const name of [
      "getCurrentAuthenticatedSession",
      "listCurrentUserSessions",
      "revokeSession",
      "revokeUserSessions",
    ]) {
      expect(Object.hasOwn(service, name)).toBe(true);
    }
    for (const name of [
      "getSessionConnectionByUser",
      "getSessionImpersonator",
      "revokeCurrentUserSession",
      "revokeCurrentUserSessions",
      "revokeCurrentUserOtherSessions",
    ]) {
      expect(Object.hasOwn(service, name)).toBe(false);
      expect(typeof Reflect.get(service, name)).toBe("function");
    }
    const userMethods = Object.getOwnPropertyNames(UserService.prototype);
    expect(userMethods).not.toContain("revokeSession");
    expect(userMethods).not.toContain("revokeUserSessions");
  });
  it.each([
    {
      type: WorkspaceService,
      special: ["createWorkspace"],
      ordinary: [
        "findOne",
        "getWorkspaceConnectionByUser",
        "updateWorkspace",
        "deleteWorkspace",
      ],
    },
    {
      type: MemberService,
      special: ["getUserForMembership"],
      ordinary: [
        "getMemberConnectionByWorkspace",
        "getMember",
        "getMemberByUser",
        "getMemberUser",
        "addMember",
        "addMemberByEmail",
        "updateMember",
        "setMemberRoles",
        "setMemberPermissions",
        "removeMember",
        "leaveWorkspace",
      ],
    },
    {
      type: InvitationService,
      special: [
        "getUserIdForInvitation",
        "acceptInvitation",
        "rejectInvitation",
      ],
      ordinary: [
        "getInvitation",
        "getInvitationByUser",
        "getInvitationByWorkspace",
        "getInvitationInviter",
        "getInvitationWorkspace",
        "getInvitationConnectionByWorkspace",
        "getInvitationConnectionByUser",
        "createInvitation",
        "cancelInvitation",
      ],
    },
  ])(
    "keeps $type.name execution boundaries scoped to explicit special operations",
    ({ type, special, ordinary }) => {
      const provider = authServiceProviders.find(
        (candidate) =>
          typeof candidate === "object" &&
          "provide" in candidate &&
          candidate.provide === type,
      ) as FactoryProvider<object>;
      const service = provider.useFactory(
        {} as EntityManager,
        {} as AuthModuleOptions,
      );
      for (const name of special)
        expect(Object.hasOwn(service, name)).toBe(true);
      for (const name of ordinary) {
        expect(Object.hasOwn(service, name)).toBe(false);
        expect(typeof Reflect.get(service, name)).toBe("function");
      }
    },
  );
});
