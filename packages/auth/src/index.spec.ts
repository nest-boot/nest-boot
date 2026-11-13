import { toZodSchema, type ZodClass } from "@nest-boot/validator";

import { CurrentApiKey } from "./api-key/decorators/current-api-key.decorator.js";
import { WorkspaceApiKey } from "./api-key/objects/workspace-api-key.object.js";
import { UserApiKeyService } from "./api-key/services/user-api-key.service.js";
import { WorkspaceApiKeyService } from "./api-key/services/workspace-api-key.service.js";
import { AuthAbility } from "./common/auth.ability.js";
import { Can } from "./common/decorators/can.decorator.js";
import { Public } from "./common/decorators/public.decorator.js";
import { authorize } from "./common/utils/authorize.util.js";
import { can } from "./common/utils/can.util.js";
import { getAuthAbility } from "./common/utils/get-auth-ability.util.js";
import { AuthGuard } from "./core/auth.guard.js";
import { AuthMiddleware } from "./core/auth.middleware.js";
import { AuthModule } from "./core/auth.module.js";
import { IS_PUBLIC_KEY } from "./core/constants/auth.constants.js";
import { Account } from "./core/entities/account.entity.js";
import { Session } from "./core/entities/session.entity.js";
import { User } from "./core/entities/user.entity.js";
import { Verification } from "./core/entities/verification.entity.js";
import { AccountService } from "./core/services/account.service.js";
import { AuthService } from "./core/services/auth.service.js";
import { SessionService } from "./core/services/session.service.js";
import { UserService } from "./core/services/user.service.js";
import * as auth from "./index.js";
import * as publicApi from "./index.js";
import { CurrentWorkspace } from "./workspace/decorators/current-workspace.decorator.js";
import { CurrentWorkspaceMember } from "./workspace/decorators/current-workspace-member.decorator.js";
import { Workspace } from "./workspace/entities/workspace.entity.js";
import { WorkspaceInvitation } from "./workspace/entities/workspace-invitation.entity.js";
import { WorkspaceMember } from "./workspace/entities/workspace-member.entity.js";
import { WorkspaceService } from "./workspace/services/workspace.service.js";
import { WorkspaceInvitationService } from "./workspace/services/workspace-invitation.service.js";
import { WorkspaceMemberService } from "./workspace/services/workspace-member.service.js";

vi.mock("better-auth", () => ({
  betterAuth: vi.fn(),
}));

vi.mock("better-auth/node", () => ({
  toNodeHandler: vi.fn(),
}));

vi.mock("better-auth/plugins", () => ({
  genericOAuth: vi.fn(),
}));

vi.mock("./core/adapters/mikro-orm-adapter.js", () => ({
  mikroOrmAdapter: vi.fn(),
}));

describe("public API", () => {
  it("exports separate API-key domain services", () => {
    expect(publicApi.UserApiKeyService).toBe(UserApiKeyService);
    expect(publicApi.WorkspaceApiKeyService).toBe(WorkspaceApiKeyService);
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
    },
    {
      name: "AccountService",
      service: AccountService,
      methods: ["getAccountConnectionByUser"],
    },
    {
      name: "WorkspaceMemberService",
      service: WorkspaceMemberService,
      methods: [
        "getCurrentWorkspaceMember",
        "getWorkspaceMemberListFilter",
        "getWorkspaceMemberConnectionByWorkspace",
        "getWorkspaceMemberByUser",
        "getWorkspaceMember",
        "getWorkspaceMemberUser",
        "addWorkspaceMember",
        "addWorkspaceMemberByEmail",
        "getUserForWorkspaceMembership",
        "updateWorkspaceMember",
        "setWorkspaceMemberRoles",
        "setWorkspaceMemberPermissions",
        "removeWorkspaceMember",
        "leaveWorkspace",
        "hasPermissions",
        "listRoles",
        "listPermissions",
        "getEffectiveWorkspaceMemberPermissions",
      ],
    },
    {
      name: "WorkspaceInvitationService",
      service: WorkspaceInvitationService,
      methods: [
        "createWorkspaceInvitation",
        "getWorkspaceInvitation",
        "getWorkspaceInvitationInviter",
        "getWorkspaceInvitationWorkspace",
        "getWorkspaceInvitationByUser",
        "getWorkspaceInvitationByWorkspace",
        "getWorkspaceInvitationConnectionByWorkspace",
        "getWorkspaceInvitationConnectionByUser",
        "acceptWorkspaceInvitation",
        "cancelWorkspaceInvitation",
        "rejectWorkspaceInvitation",
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
      name: "WorkspaceApiKeyService",
      service: WorkspaceApiKeyService,
      methods: [
        "getWorkspaceApiKeyConnection",
        "createWorkspaceApiKey",
        "updateWorkspaceApiKey",
        "deleteWorkspaceApiKey",
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
        "workspace-member:read",
        "workspace-member:write",
        "workspace-member:set-roles",
        "workspace-member:set-permissions",
        "workspace-member:invite",
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
      "WorkspaceMember",
      "WorkspaceInvitation",
      "ApiKey",
      "SystemAccount",
    ] as const;
    expect([
      ...publicApi.entities,
      ...publicApi.workspaceEntities,
    ]).toHaveLength(names.length);
    for (const name of names) {
      expect(
        [...publicApi.entities, ...publicApi.workspaceEntities].map((entity) =>
          typeof entity === "function" ? entity : entity.class,
        ),
      ).toContain(publicApi[name]);
      if (name !== "Verification" && name !== "ApiKey") {
        expect(publicApi).toHaveProperty(`${name}Connection`);
      }
    }
  });
  it("exports the GraphQL module and resolvers", () => {
    expect(publicApi.AuthResolver).toBeDefined();
    expect(publicApi.UserResolver).toBeDefined();
    expect(publicApi.SessionResolver).toBeDefined();
    for (const name of [
      "WorkspaceApiKeyResolver",
      "WorkspaceResolver",
      "WorkspaceMemberResolver",
      "WorkspaceInvitationResolver",
    ]) {
      expect(publicApi).toHaveProperty(name);
    }
    expect(publicApi).toHaveProperty("SetWorkspaceMemberRolesInput");
  });
  it("exports input and result types", () => {
    for (const name of [
      "CreateUserPayload",
      "UpdateUserPayload",
      "SetUserPermissionsPayload",
      "SetUserRolesPayload",
      "BanUserPayload",
      "UnbanUserPayload",
      "AcceptWorkspaceInvitationPayload",
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
    expect(publicApi.RemoveWorkspaceMemberPayload).toBeDefined();
    expect(publicApi.LeaveWorkspacePayload).toBeDefined();
  });
  it("should export auth modules, services, decorators, and entities", () => {
    expect(publicApi.UserService).toBe(UserService);
    expect(publicApi.IS_PUBLIC_KEY).toBe(IS_PUBLIC_KEY);
    expect(publicApi.WorkspaceApiKeyService).toBe(WorkspaceApiKeyService);
    expect(publicApi.AuthGuard).toBe(AuthGuard);
    expect(publicApi.AuthMiddleware).toBe(AuthMiddleware);
    expect(publicApi.AuthModule).toBe(AuthModule);
    expect(publicApi.AuthService).toBe(AuthService);
    expect(publicApi.Can).toBe(Can);
    expect(publicApi.CurrentApiKey).toBe(CurrentApiKey);
    expect(publicApi.CurrentWorkspace).toBe(CurrentWorkspace);
    expect(publicApi.CurrentWorkspaceMember).toBe(CurrentWorkspaceMember);
    expect(publicApi.Public).toBe(Public);
    expect(publicApi.Account).toBe(Account);
    expect(publicApi.WorkspaceApiKey).toBe(WorkspaceApiKey);
    expect(publicApi.Session).toBe(Session);
    expect(publicApi.User).toBe(User);
    expect(publicApi.Verification).toBe(Verification);
    expect(publicApi.Workspace).toBe(Workspace);
    expect(publicApi.WorkspaceInvitation).toBe(WorkspaceInvitation);
    expect(publicApi.WorkspaceMember).toBe(WorkspaceMember);
    expect(publicApi.AuthAbility).toBe(AuthAbility);
    expect(publicApi.can).toBe(can);
    expect(publicApi.getAuthAbility).toBe(getAuthAbility);
    expect(publicApi.authorize).toBe(authorize);
    expect(publicApi.SessionService).toBe(SessionService);
    expect(publicApi.WorkspaceService).toBe(WorkspaceService);
    expect(publicApi.WorkspaceMemberService).toBe(WorkspaceMemberService);
    expect(publicApi.WorkspaceInvitationService).toBe(
      WorkspaceInvitationService,
    );
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
      name: "CreateSystemAccountInput",
      values: { name: "Integration", permissions: ["user:read"] },
      required: ["name"],
      nullable: ["permissions"],
    },
    {
      name: "UpdateSystemAccountInput",
      values: {
        name: "Integration",
        enabled: false,
        permissions: ["user:read"],
      },
      required: [],
      nullable: ["permissions"],
    },
    {
      name: "CreateSystemApiKeyInput",
      values: {
        systemAccountId: "account-1",
        name: "Key",
        permissions: ["user:read"],
        prefix: "sys_",
        expiresAt: new Date("2030-01-01T00:00:00Z"),
      },
      required: ["name"],
      nullable: ["systemAccountId", "permissions", "expiresAt"],
    },
    {
      name: "UpdateSystemApiKeyInput",
      values: {
        name: "Key",
        permissions: ["user:read"],
        expiresAt: new Date("2030-01-01T00:00:00Z"),
      },
      required: [],
      nullable: ["permissions", "expiresAt"],
    },

    {
      name: "AddWorkspaceMemberInput",
      values: {
        email: "member@example.com",
        type: "USER",
        name: "Account",
        roles: ["member"],
        permissions: ["workspace:read"],
      },
      required: [],
      nullable: ["email"],
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
      name: "CreateWorkspaceApiKeyInput",
      values: {
        memberId: "123",
        name: "Key",
        expiresAt: new Date("2030-01-01T00:00:00Z"),
        prefix: "sk-",
        permissions: ["Custom:Read"],
      },
      required: ["name"],
      nullable: ["memberId", "expiresAt", "permissions"],
    },
    {
      name: "CreateWorkspaceInvitationInput",
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
      name: "SetWorkspaceMemberPermissionsInput",
      values: { permissions: [] },
      required: ["permissions"],
    },
    {
      name: "SetWorkspaceMemberRolesInput",
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
        expiresAt: new Date("2030-01-01T00:00:00Z"),
        permissions: [],
      },
      required: [],
      nullable: ["expiresAt", "permissions"],
    },
    {
      name: "UpdateWorkspaceApiKeyInput",
      values: {
        name: "Key",
        expiresAt: new Date("2030-01-01T00:00:00Z"),
        permissions: [],
      },
      required: [],
      nullable: ["expiresAt", "permissions"],
    },
    {
      name: "UpdateWorkspaceMemberInput",
      values: {
        name: "WorkspaceMember",
        email: "member@example.com",
        status: "ACTIVE",
      },
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
        auth.CreateWorkspaceApiKeyInput,
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

describe("public decorator exports", () => {
  it("exports the public and current-identity decorators", () => {
    expect(publicApi.Public).toBe(Public);
    for (const name of [
      "CurrentSession",
      "CurrentUser",
      "CurrentApiKey",
      "CurrentWorkspace",
      "CurrentWorkspaceMember",
    ]) {
      expect(publicApi).toHaveProperty(name);
    }
  });
});
