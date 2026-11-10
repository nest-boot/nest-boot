import { toZodSchema } from "@nest-boot/validator";

import { AddMemberInput } from "./add-member.input.js";

describe("input validation", () => {
  describe("AddMemberInput validation", () => {
    it.each([
      {
        Input: AddMemberInput,
        values: { email: "not-an-email" },
        field: "email",
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
