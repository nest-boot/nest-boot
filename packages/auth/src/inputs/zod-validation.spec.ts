import { toZodSchema, ZodValidationPipe } from "@nest-boot/validator";

import { AddMemberInput } from "./add-member.input.js";
import { AuthLinkSocialAccountInput } from "./auth-link-social-account.input.js";
import { AuthSignInSocialInput } from "./auth-sign-in-social.input.js";
import { BanUserInput } from "./ban-user.input.js";
import { CreateInvitationInput } from "./create-invitation.input.js";
import { CreateUserApiKeyInput } from "./create-user-api-key.input.js";
import { SetUserPermissionsInput } from "./set-user-permissions.input.js";
import { UpdateMemberInput } from "./update-member.input.js";

describe("auth Zod input constraints", () => {
  it.each([
    {
      Input: AddMemberInput,
      values: { email: "not-an-email" },
      field: "email",
    },
    { Input: BanUserInput, values: { expiresIn: 0 }, field: "expiresIn" },
    { Input: BanUserInput, values: { expiresIn: 1.5 }, field: "expiresIn" },
    {
      Input: CreateUserApiKeyInput,
      values: { name: "x".repeat(256) },
      field: "name",
    },
    {
      Input: CreateUserApiKeyInput,
      values: { name: "Key", prefix: "" },
      field: "prefix",
    },
    {
      Input: CreateUserApiKeyInput,
      values: { name: "Key", expiresAt: "2030-01-01" },
      field: "expiresAt",
    },
    {
      Input: CreateUserApiKeyInput,
      values: { name: "Key", permissions: [null] },
      field: "permissions",
    },
    {
      Input: CreateInvitationInput,
      values: { email: "member@example.com", roles: [] },
      field: "roles",
    },
    {
      Input: SetUserPermissionsInput,
      values: { permissions: "user:read" },
      field: "permissions",
    },
    {
      Input: AuthSignInSocialInput,
      values: { provider: "github", scopes: "email" },
      field: "scopes",
    },
    {
      Input: AuthLinkSocialAccountInput,
      values: { provider: "github", scopes: [1] },
      field: "scopes",
    },
    {
      Input: UpdateMemberInput,
      values: { status: "invalid" },
      field: "status",
    },
    { Input: UpdateMemberInput, values: { name: "" }, field: "name" },
  ])("$Input.name rejects invalid $field", ({ Input, values, field }) => {
    const result = toZodSchema<object>(Input).safeParse(values);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.arrayContaining([field]) }),
      ]),
    );
  });

  it("returns parsed data, preserving valid API key fields and stripping unknown properties", async () => {
    const pipe = new ZodValidationPipe();
    const values = {
      name: "Key",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      prefix: "custom",
      permissions: ["User:Get"],
    };
    const result = await pipe.transform(
      { ...values, ownerId: "unexpected-owner" },
      { type: "body", metatype: CreateUserApiKeyInput },
    );
    expect(result).toEqual(values);
    expect(result).not.toBeInstanceOf(CreateUserApiKeyInput);
  });
});
