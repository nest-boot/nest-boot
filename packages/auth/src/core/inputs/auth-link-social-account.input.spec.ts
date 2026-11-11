import { toZodSchema } from "@nest-boot/validator";

import { AuthLinkSocialAccountInput } from "./auth-link-social-account.input.js";

describe("input validation", () => {
  describe("AuthLinkSocialAccountInput validation", () => {
    it.each([
      {
        Input: AuthLinkSocialAccountInput,
        values: { provider: "github", scopes: [1] },
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
