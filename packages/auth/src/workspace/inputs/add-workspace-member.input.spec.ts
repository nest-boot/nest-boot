import { toZodSchema } from "@nest-boot/validator";

import { AddWorkspaceMemberInput } from "./add-workspace-member.input.js";

describe("input validation", () => {
  describe("AddWorkspaceMemberInput validation", () => {
    it.each([undefined, null])(
      "accepts an absent service-account email (%s)",
      (email) => {
        expect(
          toZodSchema(AddWorkspaceMemberInput).safeParse({
            type: "SERVICE_ACCOUNT",
            name: "Bot",
            email,
          }).success,
        ).toBe(true);
      },
    );
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
