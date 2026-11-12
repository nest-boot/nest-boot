import { toZodSchema } from "@nest-boot/validator";

import { UpdateWorkspaceMemberInput } from "./update-workspace-member.input.js";

describe("input validation", () => {
  describe("UpdateWorkspaceMemberInput validation", () => {
    it.each([
      {
        Input: UpdateWorkspaceMemberInput,
        values: { status: "invalid" },
        field: "status",
      },
      {
        Input: UpdateWorkspaceMemberInput,
        values: { name: "" },
        field: "name",
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
