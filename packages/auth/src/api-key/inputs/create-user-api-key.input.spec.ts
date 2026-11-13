import { toZodSchema, ZodValidationPipe } from "@nest-boot/validator";

import { CreateUserApiKeyInput } from "./create-user-api-key.input.js";

describe("input validation", () => {
  describe("CreateUserApiKeyInput validation", () => {
    it.each([
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
    ])("$Input.name rejects invalid $field", ({ Input, values, field }) => {
      const result = toZodSchema<object>(Input).safeParse(values);
      expect(result.success).toBe(false);
      expect(result.error?.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: expect.arrayContaining([field]) }),
        ]),
      );
    });
  });
});

describe("input validation", () => {
  describe("auth Zod input constraints", () => {
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
});
