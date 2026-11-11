import { toZodSchema } from "@nest-boot/validator";

import { UpdateMemberInput } from "./update-member.input.js";

describe("input validation", () => {
  describe("UpdateMemberInput validation", () => {
    it.each([
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
  });
});
