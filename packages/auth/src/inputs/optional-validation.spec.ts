import "reflect-metadata";

import {
  ZodValidationException,
  ZodValidationPipe,
} from "@nest-boot/validator";

import { AuthUpdateUserInput } from "./auth-update-user.input.js";
import { CreateApiKeyInput } from "./create-api-key.input.js";
import { UpdateApiKeyInput } from "./update-api-key.input.js";
import { UpdateMemberInput } from "./update-member.input.js";
import { UpdateUserInput } from "./update-user.input.js";
import { UpdateWorkspaceInput } from "./update-workspace.input.js";

describe("auth input omission and null validation", () => {
  const pipe = new ZodValidationPipe();

  it.each([
    { Input: UpdateUserInput, field: "email" },
    { Input: UpdateUserInput, field: "emailVerified" },
    { Input: UpdateUserInput, field: "name" },
    { Input: AuthUpdateUserInput, field: "name" },
    { Input: UpdateWorkspaceInput, field: "name" },
    { Input: UpdateMemberInput, field: "name" },
    { Input: UpdateMemberInput, field: "status" },
    { Input: UpdateApiKeyInput, field: "name" },
    { Input: UpdateApiKeyInput, field: "enabled" },
  ])(
    "$Input.name.$field permits omission but rejects null",
    async ({ Input, field }) => {
      const metadata = { type: "body" as const, metatype: Input };
      await expect(pipe.transform({}, metadata)).resolves.toEqual({});
      await expect(
        pipe.transform({ [field]: null }, metadata),
      ).rejects.toBeInstanceOf(ZodValidationException);
    },
  );

  it.each([
    { Input: UpdateUserInput, field: "image", values: {} },
    { Input: AuthUpdateUserInput, field: "image", values: {} },
    { Input: UpdateMemberInput, field: "email", values: {} },
    { Input: UpdateApiKeyInput, field: "expiresAt", values: {} },
    { Input: UpdateApiKeyInput, field: "permissions", values: {} },
    { Input: CreateApiKeyInput, field: "expiresAt", values: { name: "Key" } },
    { Input: CreateApiKeyInput, field: "permissions", values: { name: "Key" } },
  ])(
    "$Input.name.$field preserves explicit null",
    async ({ Input, field, values }) => {
      const result = await pipe.transform(
        { ...values, [field]: null },
        { type: "body", metatype: Input },
      );
      expect(result).toHaveProperty(field, null);
    },
  );
});
