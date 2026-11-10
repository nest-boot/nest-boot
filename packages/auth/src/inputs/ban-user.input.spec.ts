import { toZodSchema } from "@nest-boot/validator";

import { BanUserInput } from "./ban-user.input.js";

describe("input validation", () => {
  describe("BanUserInput validation", () => {
    it.each([
      { Input: BanUserInput, values: { expiresIn: 0 }, field: "expiresIn" },
      { Input: BanUserInput, values: { expiresIn: 1.5 }, field: "expiresIn" },
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
