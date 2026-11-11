import "reflect-metadata";

import { toZodSchema } from "@nest-boot/validator";

import { CreateUserInput } from "./create-user.input.js";

describe("configured validation", () => {
  describe("CreateUserInput configured password validation", () => {
    const { Input, field, values } = {
      Input: CreateUserInput,
      field: "password",
      values: { name: "Alice", email: "alice@example.com" },
    };
    it("defers password length to the configured auth policy", () => {
      const input = Object.assign(new Input(), values, { [field]: "123456" });
      expect(toZodSchema<object>(Input).safeParse(input).success).toBe(true);
    });
    it("requires a string password", () => {
      const input = Object.assign(new Input(), values, { [field]: 123456 });
      const result = toZodSchema<object>(Input).safeParse(input);
      expect(result.error?.issues).toEqual([
        expect.objectContaining({
          path: [field],
          code: "invalid_type",
          expected: "string",
        }),
      ]);
    });
  });
});
