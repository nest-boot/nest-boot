import { UserAbility } from "./abilities/user.ability.js";
import { WorkspaceAbility } from "./abilities/workspace.ability.js";
import { IS_PUBLIC_KEY } from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthMiddleware } from "./auth.middleware.js";
import { AuthModule } from "./auth.module.js";
import { Can } from "./decorators/can.decorator.js";
import { CurrentApiKey } from "./decorators/current-api-key.decorator.js";
import { CurrentMember } from "./decorators/current-member.decorator.js";
import { CurrentWorkspace } from "./decorators/current-workspace.decorator.js";
import { Public } from "./decorators/public.decorator.js";
import { UserCan } from "./decorators/user-can.decorator.js";
import { WorkspaceCan } from "./decorators/workspace-can.decorator.js";
import { Account } from "./entities/account.entity.js";
import { ApiKey } from "./entities/api-key.entity.js";
import { Invitation } from "./entities/invitation.entity.js";
import { Member } from "./entities/member.entity.js";
import { Session } from "./entities/session.entity.js";
import { User } from "./entities/user.entity.js";
import { Verification } from "./entities/verification.entity.js";
import { Workspace } from "./entities/workspace.entity.js";
import * as publicApi from "./index.js";
import { AccessControlService } from "./services/access-control.service.js";
import { AccountService } from "./services/account.service.js";
import { ApiKeyService } from "./services/api-key.service.js";
import { AuthService } from "./services/auth.service.js";
import { InvitationService } from "./services/invitation.service.js";
import { MemberService } from "./services/member.service.js";
import { SessionService } from "./services/session.service.js";
import { UserService } from "./services/user.service.js";
import { WorkspaceService } from "./services/workspace.service.js";
import { can } from "./utils/can.util.js";
import { getUserAbility } from "./utils/get-user-ability.util.js";
import { getWorkspaceAbility } from "./utils/get-workspace-ability.util.js";
import { userCan } from "./utils/user-can.util.js";
import { workspaceCan } from "./utils/workspace-can.util.js";
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
  it.each([
    [UserService, "listUsers"],
    [SessionService, "listUserSessions"],
    [WorkspaceService, "getFullWorkspace"],
  ] as const)(
    "does not expose the removed %s.%s collection API",
    (service, method) => {
      expect(service.prototype).not.toHaveProperty(method);
    },
  );

  it("exports account pagination from its own non-privileged service", () => {
    expect(publicApi.AccountService).toBe(AccountService);
    expect(Reflect.getMetadata("providers", AuthModule)).toContain(
      AccountService,
    );
    expect(Reflect.getMetadata("exports", AuthModule)).toContain(
      AccountService,
    );
    expect(Object.getOwnPropertyNames(UserService.prototype)).not.toContain(
      "listUserAccounts",
    );
    expect(Object.getOwnPropertyNames(AccountService.prototype)).toContain(
      "getAccountConnectionByUser",
    );
  });
  it("exports concise member and invitation names without compatibility aliases", () => {
    for (const name of [
      "Member",
      "Invitation",
      "MemberService",
      "InvitationService",
      "CurrentMember",
    ])
      expect(publicApi).toHaveProperty(name);
    for (const name of [
      "BaseWorkspaceMember",
      "BaseWorkspaceInvitation",
      "WorkspaceMemberService",
      "WorkspaceInvitationService",
      "CurrentWorkspaceMember",
    ])
      expect(publicApi).not.toHaveProperty(name);
    expect(publicApi.DEFAULT_WORKSPACE_PERMISSIONS).toEqual(
      expect.arrayContaining([
        "member:create",
        "member:update",
        "member:delete",
        "invitation:create",
        "invitation:cancel",
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
  it("keeps member and invitation operations on their own services without workspace aliases", () => {
    const workspaceMethods = Object.getOwnPropertyNames(
      WorkspaceService.prototype,
    );
    for (const name of [
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
    ]) {
      expect(MemberService.prototype).toHaveProperty(name);
      expect(workspaceMethods).not.toContain(name);
    }
    for (const name of [
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
    ]) {
      expect(InvitationService.prototype).toHaveProperty(name);
      expect(workspaceMethods).not.toContain(name);
    }
    expect(UserService.prototype).toHaveProperty("getUserConnection");
    expect(UserService.prototype).not.toHaveProperty("getConnection");
    expect(MemberService.prototype).not.toHaveProperty(
      "getWorkspaceMemberConnectionByWorkspace",
    );
    expect(InvitationService.prototype).not.toHaveProperty(
      "getWorkspaceInvitationConnectionByWorkspace",
    );
    expect(InvitationService.prototype).not.toHaveProperty(
      "getWorkspaceInvitationConnectionByUser",
    );
  });
  it("owns safe session queries and administrative revocation in SessionService", () => {
    const userMethods = Object.getOwnPropertyNames(UserService.prototype);
    const sessionMethods = Object.getOwnPropertyNames(SessionService.prototype);
    for (const name of [
      "getSessionConnectionByUser",
      "getSessionImpersonator",
      "revokeSession",
      "revokeUserSessions",
      "revokeCurrentUserSession",
      "revokeCurrentUserSessions",
      "revokeCurrentUserOtherSessions",
    ]) {
      expect(sessionMethods).toContain(name);
      expect(userMethods).not.toContain(name);
    }
    expect(userMethods).not.toContain("getSessionConnection");
    expect(sessionMethods).not.toContain("getSessionConnection");
    for (const name of [
      "revokeUserSession",
      "revokeSessions",
      "revokeOtherSessions",
    ]) {
      expect(sessionMethods).not.toContain(name);
    }
    const apiKeyMethods = Object.getOwnPropertyNames(ApiKeyService.prototype);
    expect(apiKeyMethods).toContain("getApiKeyConnectionByUser");
    expect(apiKeyMethods).toContain("getApiKeyConnectionByWorkspace");
    expect(apiKeyMethods).not.toContain("getUserConnection");
    expect(apiKeyMethods).not.toContain("getWorkspaceConnection");
    expect(apiKeyMethods).not.toContain("getUserListFilter");
    expect(apiKeyMethods).not.toContain("getWorkspaceListFilter");
  });

  it("uses deleteUser for permanent user deletion", () => {
    const methods = Object.getOwnPropertyNames(UserService.prototype);
    expect(methods).toContain("deleteUser");
    expect(methods).not.toContain("removeUser");
  });

  it("does not expose workspace ownership transfer", () => {
    expect(
      Object.getOwnPropertyNames(WorkspaceService.prototype),
    ).not.toContain("transferOwnership");
  });

  it("exposes request-scoped member lookup without the workspace argument alias", () => {
    expect(MemberService.prototype).toHaveProperty("getMember");
    expect(MemberService.prototype).not.toHaveProperty("getMemberById");
  });

  it("names request-bound authentication operations explicitly without aliases", () => {
    for (const [previous, current] of [
      ["verifyPassword", "verifyCurrentUserPassword"],
      ["changeEmail", "changeCurrentUserEmail"],
      ["changePassword", "changeCurrentUserPassword"],
      ["setPassword", "setCurrentUserPassword"],
      ["listAccounts", "listCurrentUserAccounts"],
      ["linkSocialAccount", "linkCurrentUserAccount"],
      ["unlinkAccount", "unlinkCurrentUserAccount"],
    ]) {
      expect(AuthService.prototype).toHaveProperty(current);
      expect(AuthService.prototype).not.toHaveProperty(previous);
    }
    expect(SessionService.prototype).toHaveProperty(
      "getCurrentAuthenticatedSession",
    );
    expect(SessionService.prototype).toHaveProperty("listCurrentUserSessions");
    expect(SessionService.prototype).not.toHaveProperty("getSession");
    expect(SessionService.prototype).not.toHaveProperty("listSessions");
    expect(AuthService.prototype).not.toHaveProperty(
      "linkCurrentUserSocialAccount",
    );
  });

  it("uses plural names for role collections and permission sets", () => {
    expect(UserService.prototype).toHaveProperty("setUserRoles");
    expect(UserService.prototype).not.toHaveProperty("setRole");
    expect(UserService.prototype).toHaveProperty("hasPermissions");
    expect(UserService.prototype).not.toHaveProperty("hasPermission");
    const workspaceMethods = Object.getOwnPropertyNames(
      MemberService.prototype,
    );
    expect(workspaceMethods).toContain("setMemberRoles");
    expect(workspaceMethods).not.toContain("updateMemberRoles");
    expect(MemberService.prototype).not.toHaveProperty("updateMemberRole");
    expect(MemberService.prototype).toHaveProperty("hasPermissions");
    expect(MemberService.prototype).not.toHaveProperty("hasPermission");
  });

  it.each([
    [
      UserService,
      ["setUserRoles", "getEffectiveUserPermissions"],
      ["setRoles", "getUserPermissions"],
    ],
    [
      MemberService,
      ["getMember", "getMemberByUser", "getEffectiveMemberPermissions"],
      ["getMemberById", "getMemberPermissions"],
    ],
    [SessionService, ["setSessionCookie"], ["setSession"]],
    [
      AuthService,
      ["updateCurrentUser", "deleteCurrentUser", "getAccountInfo"],
      ["updateUser", "deleteUser", "accountInfo"],
    ],
    [
      ApiKeyService,
      [
        "createUserApiKey",
        "createWorkspaceApiKey",
        "updateUserApiKey",
        "updateWorkspaceApiKey",
        "deleteUserApiKey",
        "deleteWorkspaceApiKey",
      ],
      [
        "createUserKey",
        "createWorkspaceKey",
        "updateUserKey",
        "updateWorkspaceKey",
        "deleteUserKey",
        "deleteWorkspaceKey",
      ],
    ],
  ] as const)(
    "exposes explicit method names without aliases on %p",
    (service, currentNames, oldNames) => {
      const methods = Object.getOwnPropertyNames(service.prototype);
      for (const name of currentNames) expect(methods).toContain(name);
      for (const name of oldNames) expect(methods).not.toContain(name);
    },
  );

  it("should export auth modules, services, decorators, and entities", () => {
    expect("AUTH_TOKEN" in publicApi).toBe(false);
    expect(publicApi.UserService).toBe(UserService);
    expect(publicApi.IS_PUBLIC_KEY).toBe(IS_PUBLIC_KEY);
    expect("CURRENT_API_KEY" in publicApi).toBe(false);
    expect("CURRENT_WORKSPACE" in publicApi).toBe(false);
    expect("CURRENT_WORKSPACE_MEMBER" in publicApi).toBe(false);
    expect(publicApi.ApiKeyService).toBe(ApiKeyService);
    expect(publicApi.AuthGuard).toBe(AuthGuard);
    expect(publicApi.AuthMiddleware).toBe(AuthMiddleware);
    expect(publicApi.AuthModule).toBe(AuthModule);
    expect(publicApi.AuthService).toBe(AuthService);
    expect("AuthTransactionContext" in publicApi).toBe(false);
    expect(publicApi.AccessControlService).toBe(AccessControlService);
    expect(publicApi.Can).toBe(Can);
    expect(publicApi.UserCan).toBe(UserCan);
    expect(publicApi.WorkspaceCan).toBe(WorkspaceCan);
    expect(publicApi.CurrentApiKey).toBe(CurrentApiKey);
    expect(publicApi.CurrentWorkspace).toBe(CurrentWorkspace);
    expect(publicApi.CurrentMember).toBe(CurrentMember);
    expect(publicApi.Public).toBe(Public);
    expect(publicApi.Account).toBe(Account);
    expect(publicApi.ApiKey).toBe(ApiKey);
    expect(publicApi.Session).toBe(Session);
    expect(publicApi.User).toBe(User);
    expect(publicApi.Verification).toBe(Verification);
    expect(publicApi.Workspace).toBe(Workspace);
    expect(publicApi.Invitation).toBe(Invitation);
    expect(publicApi.Member).toBe(Member);
    expect(publicApi.UserAbility).toBe(UserAbility);
    expect(publicApi.WorkspaceAbility).toBe(WorkspaceAbility);
    expect(publicApi.can).toBe(can);
    expect(publicApi.getUserAbility).toBe(getUserAbility);
    expect(publicApi.getWorkspaceAbility).toBe(getWorkspaceAbility);
    expect(publicApi.userCan).toBe(userCan);
    expect(publicApi.workspaceCan).toBe(workspaceCan);
    expect(publicApi.SessionService).toBe(SessionService);
    expect(publicApi.WorkspaceService).toBe(WorkspaceService);
    expect(publicApi.MemberService).toBe(MemberService);
    expect(publicApi.InvitationService).toBe(InvitationService);
  });
});
