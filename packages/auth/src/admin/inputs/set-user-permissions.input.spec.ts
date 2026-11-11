import { toZodSchema } from "@nest-boot/validator";

import { SetUserPermissionsInput } from "./set-user-permissions.input.js";

describe("input validation", () => {
  describe("SetUserPermissionsInput validation", () => {
    it.each([
      {
        Input: SetUserPermissionsInput,
        values: { permissions: "user:read" },
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
