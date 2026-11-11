import { toZodSchema } from "@nest-boot/validator";

import { AuthSignInSocialInput } from "./auth-sign-in-social.input.js";

describe("input validation", () => {
  describe("AuthSignInSocialInput validation", () => {
    it.each([
      {
        Input: AuthSignInSocialInput,
        values: { provider: "github", scopes: "email" },
        field: "scopes",
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
