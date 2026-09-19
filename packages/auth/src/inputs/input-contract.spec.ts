import { toZodSchema, type ZodClass } from "@nest-boot/validator";

import * as auth from "../index.js";

interface InputContract {
  name: string;
  values: Record<string, unknown>;
  required: string[];
  nullable?: string[];
}

const contracts: InputContract[] = [
  {
    name: "AddMemberInput",
    values: { email: "member@example.com" },
    required: ["email"],
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
      prefix: "sk",
      permissions: ["Custom:Read"],
    },
    required: ["name"],
    nullable: ["expiresAt", "permissions"],
  },
  {
    name: "CreateWorkspaceApiKeyInput",
    values: {
      name: "Key",
      expiresAt: new Date("2030-01-01T00:00:00Z"),
      prefix: "sk",
      permissions: ["Custom:Read"],
    },
    required: ["name"],
    nullable: ["expiresAt", "permissions"],
  },
  {
    name: "CreateInvitationInput",
    values: { email: "user@example.com", roles: ["CustomRole"], expiresIn: 1 },
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
    name: "UpdateWorkspaceApiKeyInput",
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
  { name: "UpdateWorkspaceInput", values: { name: "Workspace" }, required: [] },
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
    const schema = toZodSchema(auth.CreateUserApiKeyInput);
    for (const prefix of [
      "1key",
      "UPPER",
      "with-dash",
      "trailing\n",
      "a".repeat(33),
    ]) {
      expect(schema.safeParse({ name: "Key", prefix }).success, prefix).toBe(
        false,
      );
    }
    expect(schema.parse({ name: "Key", prefix: "a1" })).toEqual({
      name: "Key",
      prefix: "a1",
    });
  });
});
