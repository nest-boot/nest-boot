import "reflect-metadata";

import { toZodSchema } from "@nest-boot/validator";

import { AuthChangePasswordInput } from "./auth-change-password.input.js";
import { AuthResetPasswordInput } from "./auth-reset-password.input.js";
import { AuthSignUpInput } from "./auth-sign-up.input.js";
import { CreateUserInput } from "./create-user.input.js";
import { SetMemberRolesInput } from "./set-member-roles.input.js";
import { SetUserPasswordInput } from "./set-user-password.input.js";

describe("configurable input validation", () => {
  const passwordInputs = [
    {
      Input: AuthSignUpInput,
      field: "password",
      values: { name: "Alice", email: "alice@example.com" },
    },
    {
      Input: AuthResetPasswordInput,
      field: "newPassword",
      values: { token: "reset-token" },
    },
    {
      Input: AuthChangePasswordInput,
      field: "newPassword",
      values: { currentPassword: "current-password" },
    },
    {
      Input: CreateUserInput,
      field: "password",
      values: { name: "Alice", email: "alice@example.com" },
    },
    { Input: SetUserPasswordInput, field: "password", values: {} },
  ];

  it.each(passwordInputs)(
    "$Input.name defers password length to the configured auth policy",
    ({ Input, field, values }) => {
      const input = Object.assign(new Input(), values, { [field]: "123456" });

      expect(toZodSchema<object>(Input).safeParse(input).success).toBe(true);
    },
  );

  it.each(passwordInputs)(
    "$Input.name still requires a string password",
    ({ Input, field, values }) => {
      const input = Object.assign(new Input(), values, { [field]: 123456 });

      const result = toZodSchema<object>(Input).safeParse(input);
      expect(result.error?.issues).toEqual([
        expect.objectContaining({
          path: [field],
          code: "invalid_type",
          expected: "string",
        }),
      ]);
    },
  );

  it("accepts owner role names and leaves grant authorization to the Service", () => {
    const input = Object.assign(new SetMemberRolesInput(), {
      roles: ["owner"],
    });

    expect(toZodSchema(SetMemberRolesInput).safeParse(input).success).toBe(
      true,
    );
  });

  it.each([[], "owner", [123], undefined])(
    "rejects invalid role list %j",
    (roles) => {
      const input = Object.assign(new SetMemberRolesInput(), { roles });

      expect(toZodSchema(SetMemberRolesInput).safeParse(input).success).toBe(
        false,
      );
    },
  );
});
