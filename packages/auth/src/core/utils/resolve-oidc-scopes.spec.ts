import { resolveOidcScopes } from "./resolve-oidc-scopes.js";

describe("resolveOidcScopes", () => {
  beforeEach(() => {
    delete process.env.AUTH_OIDC_SCOPES;
  });

  it("should return default scopes when AUTH_OIDC_SCOPES is unset", () => {
    expect(resolveOidcScopes()).toEqual(["openid", "profile", "email"]);
  });

  it("should trim comma-separated scopes and drop blanks", () => {
    process.env.AUTH_OIDC_SCOPES = "openid, profile, email,";

    expect(resolveOidcScopes()).toEqual(["openid", "profile", "email"]);
  });
});
