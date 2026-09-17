/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import type { FactoryProvider } from "@nestjs/common";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import type { AccessControlService } from "../services/access-control.service.js";
import { InvitationService } from "../services/invitation.service.js";
import { MemberService } from "../services/member.service.js";
import { SessionService } from "../services/session.service.js";
import { UserService } from "../services/user.service.js";
import { WorkspaceService } from "../services/workspace.service.js";
import { authServiceProviders } from "./auth-service.providers.js";

describe("auth service execution boundaries", () => {
  it.each([false, true])(
    "isolates the read-only invitation identity lookup inside an RLS transaction (failure=%s)",
    async (failure) => {
      const provider = authServiceProviders.find(
        (candidate) =>
          typeof candidate === "object" &&
          "provide" in candidate &&
          candidate.provide === InvitationService,
      ) as FactoryProvider<InvitationService>;
      const reader = {
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
      const access = {
        assertCurrentWorkspace: vi.fn(),
        assertCurrentUser: vi.fn(),
        assertWorkspaceCan: vi.fn(),
      };
      const service = await provider.useFactory(current, {}, access);
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
        keepTransactionContext: false,
      });
      expect(current.clearSessionContext).not.toHaveBeenCalled();
      expect(reader.transactional).toHaveBeenCalledWith(expect.any(Function), {
        readOnly: true,
      });
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
    const access = {
      assertUserCan: vi.fn(),
    } as unknown as AccessControlService;
    const service = provider.useFactory({}, {} as EntityManager, access);

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
      special: ["createWorkspace", "deleteWorkspace"],
      ordinary: ["findOne", "getWorkspaceConnectionByUser", "updateWorkspace"],
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
        {} as AccessControlService,
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
