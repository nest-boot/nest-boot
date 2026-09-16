import "reflect-metadata";

import { validateSync } from "class-validator";

import {
  AuthChangePasswordInput,
  AuthResetPasswordInput,
  AuthSignUpInput,
} from "./auth.input.js";
import { SetMemberRolesInput } from "./set-member-roles.input.js";
import { CreateUserInput, SetUserPasswordInput } from "./user.input.js";

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

      expect(validateSync(input)).toEqual([]);
    },
  );

  it.each(passwordInputs)(
    "$Input.name still requires a string password",
    ({ Input, field, values }) => {
      const input = Object.assign(new Input(), values, { [field]: 123456 });

      expect(validateSync(input)).toEqual([
        expect.objectContaining({
          property: field,
          constraints: { isString: expect.any(String) },
        }),
      ]);
    },
  );

  it("accepts owner role names and leaves grant authorization to the Service", () => {
    const input = Object.assign(new SetMemberRolesInput(), {
      roles: ["owner"],
    });

    expect(validateSync(input)).toEqual([]);
  });

  it.each([[], "owner", [123], undefined])(
    "rejects invalid role list %j",
    (roles) => {
      const input = Object.assign(new SetMemberRolesInput(), { roles });

      expect(validateSync(input)).not.toEqual([]);
    },
  );
});
