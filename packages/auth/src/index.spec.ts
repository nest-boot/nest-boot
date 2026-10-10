import { AuthAbility } from "./auth.ability.js";
import { IS_PUBLIC_KEY } from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthMiddleware } from "./auth.middleware.js";
import { AuthModule } from "./auth.module.js";
import { Can } from "./decorators/can.decorator.js";
import { CurrentApiKey } from "./decorators/current-api-key.decorator.js";
import { CurrentMember } from "./decorators/current-member.decorator.js";
import { CurrentWorkspace } from "./decorators/current-workspace.decorator.js";
import { Public } from "./decorators/public.decorator.js";
import { Account } from "./entities/account.entity.js";
import { Invitation } from "./entities/invitation.entity.js";
import { Member } from "./entities/member.entity.js";
import { MemberApiKey } from "./entities/member-api-key.entity.js";
import { Session } from "./entities/session.entity.js";
import { User } from "./entities/user.entity.js";
import { Verification } from "./entities/verification.entity.js";
import { Workspace } from "./entities/workspace.entity.js";
import { InvitationService } from "./features/invitations/invitation.service.js";
import * as publicApi from "./index.js";
import { AccountService } from "./services/account.service.js";
import { AuthService } from "./services/auth.service.js";
import { MemberService } from "./services/member.service.js";
import { MemberApiKeyService } from "./services/member-api-key.service.js";
import { SessionService } from "./services/session.service.js";
import { UserService } from "./services/user.service.js";
import { UserApiKeyService } from "./services/user-api-key.service.js";
import { WorkspaceService } from "./services/workspace.service.js";
import { authorize } from "./utils/authorize.util.js";
import { can } from "./utils/can.util.js";
import { getAuthAbility } from "./utils/get-auth-ability.util.js";
vi.mock("better-auth", () => ({
  betterAuth: vi.fn(),
}));
vi.mock("better-auth/node", () => ({
  toNodeHandler: vi.fn(),
}));
vi.mock("better-auth/plugins", () => ({
  genericOAuth: vi.fn(),
}));
vi.mock("./adapters/mikro-orm-adapter.js", () => ({
  mikroOrmAdapter: vi.fn(),
}));

describe("public API", () => {
  it("exports separate API-key domain services", () => {
    expect(publicApi.UserApiKeyService).toBe(UserApiKeyService);
    expect(publicApi.MemberApiKeyService).toBe(MemberApiKeyService);

    for (const method of [
      "getUserApiKey",
      "getUserApiKeyConnection",
      "createUserApiKey",
      "updateUserApiKey",
      "deleteUserApiKey",
    ]) {
      expect(UserApiKeyService.prototype).toHaveProperty(method);
      expect(MemberApiKeyService.prototype).not.toHaveProperty(method);
    }
    expect(UserApiKeyService.prototype).not.toHaveProperty("getMemberApiKey");
  });
  it.each([
    {
      name: "UserService",
      service: UserService,
      methods: [
        "getUserConnection",
        "deleteUser",
        "setUserRoles",
        "hasPermissions",
        "getEffectiveUserPermissions",
      ],
    },
    {
      name: "AccountService",
      service: AccountService,
      methods: ["getAccountConnectionByUser"],
    },
    {
      name: "MemberService",
      service: MemberService,
      methods: [
        "getCurrentMember",
        "getMemberListFilter",
        "getMemberConnectionByWorkspace",
        "getMemberByUser",
        "getMember",
        "getMemberUser",
        "addMember",
        "addMemberByEmail",
        "getUserForMembership",
        "updateMember",
        "setMemberRoles",
        "setMemberPermissions",
        "removeMember",
        "leaveWorkspace",
        "hasPermissions",
        "listRoles",
        "listPermissions",
        "getEffectiveMemberPermissions",
      ],
    },
    {
      name: "InvitationService",
      service: InvitationService,
      methods: [
        "createInvitation",
        "getInvitation",
        "getInvitationInviter",
        "getInvitationWorkspace",
        "getInvitationByUser",
        "getInvitationByWorkspace",
        "getInvitationConnectionByWorkspace",
        "getInvitationConnectionByUser",
        "acceptInvitation",
        "cancelInvitation",
        "rejectInvitation",
      ],
    },
    {
      name: "SessionService",
      service: SessionService,
      methods: [
        "getSessionConnectionByUser",
        "getSessionImpersonator",
        "revokeSession",
        "revokeUserSessions",
        "revokeCurrentUserSession",
        "revokeCurrentUserSessions",
        "revokeCurrentUserOtherSessions",
        "getCurrentAuthenticatedSession",
        "listCurrentUserSessions",
        "setSessionCookie",
      ],
    },
    {
      name: "MemberApiKeyService",
      service: MemberApiKeyService,
      methods: [
        "getMemberApiKeyConnection",
        "createMemberApiKey",
        "updateMemberApiKey",
        "deleteMemberApiKey",
      ],
    },
    {
      name: "AuthService",
      service: AuthService,
      methods: [
        "verifyCurrentUserPassword",
        "changeCurrentUserEmail",
        "changeCurrentUserPassword",
        "setCurrentUserPassword",
        "listCurrentUserAccounts",
        "linkCurrentUserAccount",
        "unlinkCurrentUserAccount",
        "updateCurrentUser",
        "deleteCurrentUser",
        "getAccountInfo",
      ],
    },
  ])("exports the $name methods", ({ service, methods }) => {
    for (const method of methods) {
      expect(service.prototype).toHaveProperty(method);
    }
  });

  it("registers and exports AccountService through AuthModule", () => {
    expect(publicApi.AccountService).toBe(AccountService);
    expect(Reflect.getMetadata("providers", AuthModule)).toContain(
      AccountService,
    );
    expect(Reflect.getMetadata("exports", AuthModule)).toContain(
      AccountService,
    );
  });

  it("exports the member and invitation permission catalog", () => {
    expect(publicApi.DEFAULT_WORKSPACE_PERMISSIONS).toEqual(
      expect.arrayContaining([
        "member:read",
        "member:write",
        "member:set-roles",
        "member:set-permissions",
        "member:invite",
      ]),
    );
  });

  it("owns all concrete auth entities and connection types", () => {
    const names = [
      "User",
      "Account",
      "Session",
      "Verification",
      "Workspace",
      "Member",
      "Invitation",
      "UserApiKey",
      "MemberApiKey",
    ] as const;
    expect(publicApi.entities).toHaveLength(names.length);
    for (const name of names) {
      expect(publicApi.entities).toContain(publicApi[name]);
      if (name !== "Verification")
        expect(publicApi).toHaveProperty(`${name}Connection`);
    }
  });
  it("exports the GraphQL module and resolvers", () => {
    expect(publicApi.AuthResolver).toBeDefined();
    expect(publicApi.UserResolver).toBeDefined();
    expect(publicApi.SessionResolver).toBeDefined();
    for (const name of [
      "MemberApiKeyResolver",
      "WorkspaceResolver",
      "MemberResolver",
      "InvitationResolver",
    ]) {
      expect(publicApi).toHaveProperty(name);
    }

    expect(publicApi).toHaveProperty("SetMemberRolesInput");
  });

  it("exports input and result types", () => {
    for (const name of [
      "CreateUserPayload",
      "UpdateUserPayload",
      "SetUserPermissionsPayload",
      "SetUserRolesPayload",
      "BanUserPayload",
      "UnbanUserPayload",
      "AcceptInvitationPayload",
    ]) {
      expect(publicApi).toHaveProperty(name);
    }

    expect(publicApi.SignUpPayload).toBeDefined();
    expect(publicApi.AuthSignInInput).toBeDefined();
    expect(publicApi.AuthSignInResultType).toBeDefined();
    expect(publicApi.CreateUserInput).toBeDefined();
    expect(publicApi.CreateWorkspacePayload).toBeDefined();
    expect(publicApi.DeleteWorkspacePayload).toBeDefined();
    expect(publicApi.DeleteUserPayload).toBeDefined();
    expect(publicApi.RemoveMemberPayload).toBeDefined();
    expect(publicApi.LeaveWorkspacePayload).toBeDefined();
  });

  it("should export auth modules, services, decorators, and entities", () => {
    expect(publicApi.UserService).toBe(UserService);
    expect(publicApi.IS_PUBLIC_KEY).toBe(IS_PUBLIC_KEY);
    expect(publicApi.MemberApiKeyService).toBe(MemberApiKeyService);
    expect(publicApi.AuthGuard).toBe(AuthGuard);
    expect(publicApi.AuthMiddleware).toBe(AuthMiddleware);
    expect(publicApi.AuthModule).toBe(AuthModule);
    expect(publicApi.AuthService).toBe(AuthService);
    expect(publicApi.Can).toBe(Can);
    expect(publicApi.CurrentApiKey).toBe(CurrentApiKey);
    expect(publicApi.CurrentWorkspace).toBe(CurrentWorkspace);
    expect(publicApi.CurrentMember).toBe(CurrentMember);
    expect(publicApi.Public).toBe(Public);
    expect(publicApi.Account).toBe(Account);
    expect(publicApi.MemberApiKey).toBe(MemberApiKey);
    expect(publicApi.Session).toBe(Session);
    expect(publicApi.User).toBe(User);
    expect(publicApi.Verification).toBe(Verification);
    expect(publicApi.Workspace).toBe(Workspace);
    expect(publicApi.Invitation).toBe(Invitation);
    expect(publicApi.Member).toBe(Member);
    expect(publicApi.AuthAbility).toBe(AuthAbility);
    expect(publicApi.can).toBe(can);
    expect(publicApi.getAuthAbility).toBe(getAuthAbility);
    expect(publicApi.authorize).toBe(authorize);
    expect(publicApi.SessionService).toBe(SessionService);
    expect(publicApi.WorkspaceService).toBe(WorkspaceService);
    expect(publicApi.MemberService).toBe(MemberService);
    expect(publicApi.InvitationService).toBe(InvitationService);
  });
});
