import { toZodSchema, type ZodClass } from "@nest-boot/validator";

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
import * as auth from "./index.js";
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
      if (name !== "Verification") {
        expect(publicApi).toHaveProperty(`${name}Connection`);
      }
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

describe("exported input contracts", () => {
  interface InputContract {
    name: string;
    values: Record<string, unknown>;
    required: string[];
    nullable?: string[];
  }

  const contracts: InputContract[] = [
    {
      name: "AddMemberInput",
      values: {
        email: "member@example.com",
        type: "USER",
        name: "Account",
        roles: ["member"],
        permissions: ["workspace:read"],
      },
      required: [],
    },
    {
      name: "AuthChangeEmailInput",
      values: { newEmail: "new@example.com", callbackURL: "/profile" },
      required: ["newEmail"],
    },
    {
      name: "AuthChangePasswordInput",
      values: {
        currentPassword: " old ",
        newPassword: " new ",
        revokeOtherSessions: false,
      },
      required: ["currentPassword", "newPassword"],
    },
    {
      name: "AuthDeleteUserInput",
      values: { callbackURL: "/goodbye", password: " secret ", token: "token" },
      required: [],
    },
    {
      name: "AuthLinkSocialAccountInput",
      values: {
        provider: "custom-provider",
        callbackURL: "/profile",
        errorCallbackURL: "/error",
        scopes: ["custom:Scope"],
        loginHint: "login",
      },
      required: ["provider"],
    },
    {
      name: "AuthRequestPasswordResetInput",
      values: { email: "user@example.com", redirectTo: "/reset" },
      required: ["email"],
    },
    {
      name: "AuthResetPasswordInput",
      values: { newPassword: " pass ", token: "token" },
      required: ["newPassword", "token"],
    },
    {
      name: "AuthSendVerificationEmailInput",
      values: { email: "user@example.com", callbackURL: "/verified" },
      required: ["email"],
    },
    {
      name: "AuthSignInInput",
      values: {
        email: "user@example.com",
        password: "pass",
        callbackURL: "/app",
        rememberMe: false,
      },
      required: ["email", "password"],
    },
    {
      name: "AuthSignInSocialInput",
      values: {
        provider: "custom-provider",
        callbackURL: "/app",
        newUserCallbackURL: "/new",
        errorCallbackURL: "/error",
        scopes: ["custom:Scope"],
        requestSignUp: false,
        loginHint: "login",
      },
      required: ["provider"],
    },
    {
      name: "AuthSignUpInput",
      values: {
        name: "User",
        email: "user@example.com",
        password: "pass",
        image: "/avatar.png",
        callbackURL: "/app",
        rememberMe: false,
      },
      required: ["name", "email", "password"],
    },
    {
      name: "AuthUpdateUserInput",
      values: { name: "User", image: "/avatar.png" },
      required: [],
      nullable: ["image"],
    },
    {
      name: "BanUserInput",
      values: { reason: "Reason", expiresIn: 1 },
      required: [],
    },
    {
      name: "CreateUserApiKeyInput",
      values: {
        name: "Key",
        expiresAt: new Date("2030-01-01T00:00:00Z"),
        prefix: "sk-",
        permissions: ["Custom:Read"],
      },
      required: ["name"],
      nullable: ["expiresAt", "permissions"],
    },
    {
      name: "CreateMemberApiKeyInput",
      values: {
        memberId: "123",
        name: "Key",
        expiresAt: new Date("2030-01-01T00:00:00Z"),
        prefix: "sk-",
        permissions: ["Custom:Read"],
      },
      required: ["name"],
      nullable: ["expiresAt", "permissions"],
    },
    {
      name: "CreateInvitationInput",
      values: {
        email: "user@example.com",
        roles: ["CustomRole"],
        expiresIn: 1,
      },
      required: ["email", "roles"],
    },
    {
      name: "CreateUserInput",
      values: {
        email: "user@example.com",
        name: "User",
        password: "pass",
        roles: ["CustomRole"],
        permissions: ["Custom:Read"],
      },
      required: ["email", "name", "password"],
    },
    {
      name: "CreateWorkspaceInput",
      values: { name: "Workspace" },
      required: ["name"],
    },
    {
      name: "SetMemberPermissionsInput",
      values: { permissions: [] },
      required: ["permissions"],
    },
    {
      name: "SetMemberRolesInput",
      values: { roles: ["CustomRole"] },
      required: ["roles"],
    },
    {
      name: "SetUserPasswordInput",
      values: { password: "pass" },
      required: ["password"],
    },
    {
      name: "SetUserPermissionsInput",
      values: { permissions: [] },
      required: ["permissions"],
    },
    { name: "SetUserRolesInput", values: { roles: [] }, required: ["roles"] },
    {
      name: "UpdateUserApiKeyInput",
      values: {
        name: "Key",
        enabled: false,
        expiresAt: new Date("2030-01-01T00:00:00Z"),
        permissions: [],
      },
      required: [],
      nullable: ["expiresAt", "permissions"],
    },
    {
      name: "UpdateMemberApiKeyInput",
      values: {
        name: "Key",
        enabled: false,
        expiresAt: new Date("2030-01-01T00:00:00Z"),
        permissions: [],
      },
      required: [],
      nullable: ["expiresAt", "permissions"],
    },
    {
      name: "UpdateMemberInput",
      values: { name: "Member", email: "member@example.com", status: "ACTIVE" },
      required: [],
      nullable: ["email"],
    },
    {
      name: "UpdateUserInput",
      values: {
        email: "user@example.com",
        emailVerified: false,
        name: "User",
        image: "/avatar.png",
      },
      required: [],
      nullable: ["image"],
    },
    {
      name: "UpdateWorkspaceInput",
      values: { name: "Workspace" },
      required: [],
    },
    { name: "UserIdInput", values: { id: "opaque-id" }, required: ["id"] },
  ];

  const inputs = Object.fromEntries(
    Object.entries(auth).filter(
      ([name, value]) => name.endsWith("Input") && typeof value === "function",
    ),
  ) as Record<string, ZodClass>;

  describe("auth input contracts", () => {
    it("covers every exported Input", () => {
      expect(contracts.map(({ name }) => name).sort()).toEqual(
        Object.keys(inputs).sort(),
      );
    });
    it.each(contracts)(
      "$name preserves fields and enforces omission/null semantics",
      ({ name, values, required, nullable = [] }) => {
        const schema = toZodSchema(inputs[name]);
        expect(Object.keys(schema.shape).sort()).toEqual(
          Object.keys(values).sort(),
        );
        expect(schema.parse(values)).toEqual(values);
        for (const field of Object.keys(values)) {
          const omitted = Object.fromEntries(
            Object.entries(values).filter(([key]) => key !== field),
          );
          expect(
            schema.safeParse(omitted).success,
            `${name}.${field} omission`,
          ).toBe(!required.includes(field));
          expect(
            schema.safeParse({ ...values, [field]: null }).success,
            `${name}.${field} null`,
          ).toBe(nullable.includes(field));
        }
      },
    );
    it("rejects blank and oversized display names consistently", () => {
      for (const { name, values } of contracts.filter(
        ({ values }) => "name" in values,
      )) {
        const schema = toZodSchema(inputs[name]);
        for (const invalid of ["", " \n\t ", "x".repeat(256)]) {
          expect(
            schema.safeParse({ ...values, name: invalid }).success,
            name,
          ).toBe(false);
        }
        expect(schema.parse({ ...values, name: "  Name  " })).toMatchObject({
          name: "Name",
        });
      }
    });
    it("rejects stored strings exceeding the database limits", () => {
      const longEmail = `user@${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.com`;
      for (const { name, values } of contracts) {
        const schema = toZodSchema(inputs[name]);
        for (const field of ["email", "newEmail", "image", "reason"].filter(
          (field) => field in values,
        )) {
          const invalid = field.toLowerCase().includes("email")
            ? longEmail
            : "x".repeat(256);
          expect(
            schema.safeParse({ ...values, [field]: invalid }).success,
            `${name}.${field}`,
          ).toBe(false);
        }
      }
    });
    it("validates API-key prefixes before the Service", () => {
      for (const input of [
        auth.CreateUserApiKeyInput,
        auth.CreateMemberApiKeyInput,
      ]) {
        const schema = toZodSchema(input);
        for (const prefix of [
          "1key",
          "UPPER",
          "-leading-dash",
          "_leading-underscore",
          "trailing\n",
          "a".repeat(33),
        ]) {
          expect(
            schema.safeParse({ name: "Key", prefix }).success,
            prefix,
          ).toBe(false);
        }
        for (const prefix of ["a1", "sk-", "user_", "ws_"]) {
          expect(schema.parse({ name: "Key", prefix })).toEqual({
            name: "Key",
            prefix,
          });
        }
      }
    });
  });
});
