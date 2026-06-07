import { assertNoDuplicateGenericOAuthPlugin } from "./assert-no-duplicate-generic-oauth-plugin";

describe("assertNoDuplicateGenericOAuthPlugin", () => {
  it("should allow undefined plugins", () => {
    expect(() => {
      assertNoDuplicateGenericOAuthPlugin();
    }).not.toThrow();
  });

  it("should allow non-generic-oauth plugins", () => {
    expect(() => {
      assertNoDuplicateGenericOAuthPlugin([
        {
          id: "custom-plugin",
        },
      ]);
    }).not.toThrow();
  });

  it("should reject manually configured genericOAuth plugins", () => {
    expect(() => {
      assertNoDuplicateGenericOAuthPlugin([
        {
          id: "generic-oauth",
        },
      ]);
    }).toThrow("AUTH_OIDC_*");
  });
});
