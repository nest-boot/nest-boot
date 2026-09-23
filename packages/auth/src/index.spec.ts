import { AuthAbility } from "./abilities/auth.ability.js";
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
import { Session } from "./entities/session.entity.js";
import { User } from "./entities/user.entity.js";
import { Verification } from "./entities/verification.entity.js";
import { Workspace } from "./entities/workspace.entity.js";
import { WorkspaceApiKey } from "./entities/workspace-api-key.entity.js";
import { InvitationService } from "./features/invitations/invitation.service.js";
import * as publicApi from "./index.js";
import { AccountService } from "./services/account.service.js";
import { AuthService } from "./services/auth.service.js";
import { MemberService } from "./services/member.service.js";
import { SessionService } from "./services/session.service.js";
import { UserService } from "./services/user.service.js";
import { UserApiKeyService } from "./services/user-api-key.service.js";
import { WorkspaceService } from "./services/workspace.service.js";
import { WorkspaceApiKeyService } from "./services/workspace-api-key.service.js";
import { assertCan } from "./utils/assert-can.util.js";
import { can } from "./utils/can.util.js";
import { getAbility } from "./utils/get-ability.util.js";
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
  it("exports separate API-key domain services without the old mixed service", () => {
    expect(publicApi.UserApiKeyService).toBe(UserApiKeyService);
    expect(publicApi.WorkspaceApiKeyService).toBe(WorkspaceApiKeyService);
    expect(publicApi).not.toHaveProperty("ApiKeyService");
    expect(publicApi).not.toHaveProperty("ApiKey");
    for (const method of [
      "getUserApiKey",
      "getUserApiKeyConnection",
      "createUserApiKey",
      "updateUserApiKey",
      "deleteUserApiKey",
    ]) {
      expect(UserApiKeyService.prototype).toHaveProperty(method);
      expect(WorkspaceApiKeyService.prototype).not.toHaveProperty(method);
    }
    expect(UserApiKeyService.prototype).not.toHaveProperty(
      "getWorkspaceApiKey",
    );
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
      removed: [
        "listUsers",
        "listUserAccounts",
        "getConnection",
        "getSessionConnection",
        "removeUser",
        "setRole",
        "setRoles",
        "hasPermission",
        "getUserPermissions",
      ],
    },
    {
      name: "AccountService",
      service: AccountService,
      methods: ["getAccountConnectionByUser"],
      removed: [],
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
      removed: [
        "getWorkspaceMemberConnectionByWorkspace",
        "getMemberById",
        "getMemberPermissions",
        "updateMemberRoles",
        "updateMemberRole",
        "hasPermission",
      ],
      previousService: WorkspaceService,
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
      removed: [
        "getWorkspaceInvitationConnectionByWorkspace",
        "getWorkspaceInvitationConnectionByUser",
      ],
      previousService: WorkspaceService,
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
      removed: [
        "listUserSessions",
        "getSessionConnection",
        "revokeUserSession",
        "revokeSessions",
        "revokeOtherSessions",
        "getSession",
        "listSessions",
        "setSession",
      ],
      previousService: UserService,
    },
    {
      name: "WorkspaceApiKeyService",
      service: WorkspaceApiKeyService,
      methods: [
        "getWorkspaceApiKeyConnection",
        "createWorkspaceApiKey",
        "updateWorkspaceApiKey",
        "deleteWorkspaceApiKey",
      ],
      removed: [
        "getUserConnection",
        "getWorkspaceConnection",
        "getUserListFilter",
        "getWorkspaceListFilter",
        "createUserKey",
        "createWorkspaceKey",
        "updateUserKey",
        "updateWorkspaceKey",
        "deleteUserKey",
        "deleteWorkspaceKey",
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
      removed: [
        "verifyPassword",
        "changeEmail",
        "changePassword",
        "setPassword",
        "listAccounts",
        "linkSocialAccount",
        "unlinkAccount",
        "linkCurrentUserSocialAccount",
        "updateUser",
        "deleteUser",
        "accountInfo",
      ],
    },
    {
      name: "WorkspaceService",
      service: WorkspaceService,
      methods: [],
      removed: ["getFullWorkspace", "transferOwnership"],
    },
  ])(
    "keeps the $name method contract without compatibility aliases",
    ({ service, methods, removed, previousService }) => {
      for (const method of methods) {
        expect(service.prototype).toHaveProperty(method);
        if (previousService)
          expect(previousService.prototype).not.toHaveProperty(method);
      }
      for (const method of removed)
        expect(service.prototype).not.toHaveProperty(method);
    },
  );

  it("registers and exports AccountService through AuthModule", () => {
    expect(publicApi.AccountService).toBe(AccountService);
    expect(Reflect.getMetadata("providers", AuthModule)).toContain(
      AccountService,
    );
    expect(Reflect.getMetadata("exports", AuthModule)).toContain(
      AccountService,
    );
  });

  it("does not export legacy workspace member and invitation aliases", () => {
    for (const name of [
      "BaseWorkspaceMember",
      "BaseWorkspaceInvitation",
      "WorkspaceMemberService",
      "WorkspaceInvitationService",
      "CurrentWorkspaceMember",
    ])
      expect(publicApi).not.toHaveProperty(name);
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
    expect(
      publicApi.DEFAULT_WORKSPACE_PERMISSIONS.some(
        (permission) =>
          permission.startsWith("WorkspaceMember:") ||
          permission.startsWith("WorkspaceInvitation:"),
      ),
    ).toBe(false);
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
      "WorkspaceApiKey",
    ] as const;
    expect(publicApi.entities).toHaveLength(names.length);
    for (const name of names) {
      expect(publicApi.entities).toContain(publicApi[name]);
      expect(publicApi).not.toHaveProperty(`Base${name}`);
      if (name !== "Verification")
        expect(publicApi).toHaveProperty(`${name}Connection`);
    }
    expect(publicApi).not.toHaveProperty("AuthGraphQLModule");
  });
  it("does not export provider credential transport types", () => {
    for (const name of [
      "AuthAccountSelectorInput",
      "AuthAccountIdentityType",
      "AuthAccessTokenType",
      "AuthRefreshedTokenType",
      "AuthAccountInfoType",
    ])
      expect(publicApi).not.toHaveProperty(name);
  });
  it("exports the GraphQL module and resolvers", () => {
    expect(publicApi.AuthResolver).toBeDefined();
    expect(publicApi.UserResolver).toBeDefined();
    expect(publicApi.SessionResolver).toBeDefined();
    for (const name of [
      "WorkspaceApiKeyResolver",
      "WorkspaceResolver",
      "MemberResolver",
      "InvitationResolver",
    ]) {
      expect(publicApi).toHaveProperty(name);
      expect(publicApi).not.toHaveProperty(`create${name}`);
    }
    expect(publicApi).not.toHaveProperty("AuthRoleType");
    for (const token of [
      "API_KEY_RESOLVER_OPTIONS",
      "WORKSPACE_RESOLVER_OPTIONS",
      "WORKSPACE_MEMBER_RESOLVER_OPTIONS",
      "WORKSPACE_INVITATION_RESOLVER_OPTIONS",
    ])
      expect(publicApi).not.toHaveProperty(token);
    expect(publicApi).toHaveProperty("SetMemberRolesInput");
    expect(publicApi).not.toHaveProperty("UpdateMemberRolesInput");
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
    expect(publicApi).not.toHaveProperty("AcceptInvitationResult");
    expect(publicApi.SignUpPayload).toBeDefined();
    expect(publicApi).not.toHaveProperty("AuthSignUpResultType");
    expect(publicApi.AuthSignInInput).toBeDefined();
    expect(publicApi.AuthSignInResultType).toBeDefined();
    expect(publicApi.CreateUserInput).toBeDefined();
    expect(publicApi.CreateWorkspacePayload).toBeDefined();
    expect(publicApi.DeleteWorkspacePayload).toBeDefined();
    expect(publicApi.DeleteUserPayload).toBeDefined();
    expect(publicApi.RemoveMemberPayload).toBeDefined();
    expect(publicApi.LeaveWorkspacePayload).toBeDefined();
    expect(publicApi).not.toHaveProperty("CreateWorkspaceServiceAccountInput");
    expect(publicApi).not.toHaveProperty("CreateServiceAccountMemberInput");
    expect(publicApi).not.toHaveProperty("UserListType");
    expect(publicApi).not.toHaveProperty("ListUsersInput");
    expect(publicApi).not.toHaveProperty("AuthUserType");
    expect(publicApi).not.toHaveProperty("AuthAccountType");
  });

  it("should export auth modules, services, decorators, and entities", () => {
    expect("AUTH_TOKEN" in publicApi).toBe(false);
    expect(publicApi.UserService).toBe(UserService);
    expect(publicApi.IS_PUBLIC_KEY).toBe(IS_PUBLIC_KEY);
    expect("CURRENT_API_KEY" in publicApi).toBe(false);
    expect("CURRENT_WORKSPACE" in publicApi).toBe(false);
    expect("CURRENT_WORKSPACE_MEMBER" in publicApi).toBe(false);
    expect(publicApi.WorkspaceApiKeyService).toBe(WorkspaceApiKeyService);
    expect(publicApi.AuthGuard).toBe(AuthGuard);
    expect(publicApi.AuthMiddleware).toBe(AuthMiddleware);
    expect(publicApi.AuthModule).toBe(AuthModule);
    expect(publicApi.AuthService).toBe(AuthService);
    expect("AuthTransactionContext" in publicApi).toBe(false);
    expect(publicApi).not.toHaveProperty("AccessControlService");
    expect(publicApi.Can).toBe(Can);
    expect(publicApi.CurrentApiKey).toBe(CurrentApiKey);
    expect(publicApi.CurrentWorkspace).toBe(CurrentWorkspace);
    expect(publicApi.CurrentMember).toBe(CurrentMember);
    expect(publicApi.Public).toBe(Public);
    expect(publicApi.Account).toBe(Account);
    expect(publicApi.WorkspaceApiKey).toBe(WorkspaceApiKey);
    expect(publicApi.Session).toBe(Session);
    expect(publicApi.User).toBe(User);
    expect(publicApi.Verification).toBe(Verification);
    expect(publicApi.Workspace).toBe(Workspace);
    expect(publicApi.Invitation).toBe(Invitation);
    expect(publicApi.Member).toBe(Member);
    expect(publicApi.AuthAbility).toBe(AuthAbility);
    for (const name of [
      "UserAbility",
      "WorkspaceAbility",
      "UserCan",
      "WorkspaceCan",
      "userCan",
      "workspaceCan",
      "getUserAbility",
      "getWorkspaceAbility",
    ]) {
      expect(publicApi).not.toHaveProperty(name);
    }
    expect(publicApi.can).toBe(can);
    expect(publicApi.assertCan).toBe(assertCan);
    expect(publicApi.getAbility).toBe(getAbility);
    expect(publicApi.SessionService).toBe(SessionService);
    expect(publicApi.WorkspaceService).toBe(WorkspaceService);
    expect(publicApi.MemberService).toBe(MemberService);
    expect(publicApi.InvitationService).toBe(InvitationService);
  });
});
