import { toZodSchema } from "@nest-boot/validator";

import { CreateWorkspaceInvitationInput } from "./create-workspace-invitation.input.js";

describe("input validation", () => {
  describe("CreateWorkspaceInvitationInput validation", () => {
    it.each([
      {
        Input: CreateWorkspaceInvitationInput,
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
