import { toZodSchema } from "@nest-boot/validator";

import { AddWorkspaceMemberInput } from "./add-workspace-member.input.js";

describe("input validation", () => {
  describe("AddWorkspaceMemberInput validation", () => {
    it.each([
      {
        Input: AddWorkspaceMemberInput,
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
