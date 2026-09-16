import type { EntityManager } from "@mikro-orm/core";
import type { FactoryProvider } from "@nestjs/common";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import type { AccessControlService } from "../services/access-control.service.js";
import { InvitationService } from "../services/invitation.service.js";
import { MemberService } from "../services/member.service.js";
import { SessionService } from "../services/session.service.js";
import { UserService } from "../services/user.service.js";
import { WorkspaceService } from "../services/workspace.service.js";
import { authServiceProviders } from "./auth-service.providers.js";

describe("auth service execution boundaries", () => {
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
    const service = provider.useFactory(
      {},
      {} as EntityManager,
      {} as AuthModuleOptions,
      access,
    );

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
      "listUserSessions",
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
      ordinary: [
        "findOne",
        "getWorkspaceConnectionByUser",
        "getFullWorkspace",
        "updateWorkspace",
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
