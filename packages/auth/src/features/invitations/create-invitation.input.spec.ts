import { toZodSchema } from "@nest-boot/validator";

import { CreateInvitationInput } from "./create-invitation.input.js";

describe("input validation", () => {
  describe("CreateInvitationInput validation", () => {
    it.each([
      {
        Input: CreateInvitationInput,
        values: { email: "member@example.com", roles: [] },
        field: "roles",
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
