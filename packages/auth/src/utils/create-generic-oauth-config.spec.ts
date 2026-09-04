import { createGenericOAuthConfig } from "./create-generic-oauth-config.js";

describe("createGenericOAuthConfig", () => {
  const customProvider = {
    providerId: "company",
    name: "Company SSO",
    clientId: "client-id",
    clientSecret: "client-secret",
    discoveryUrl:
      "https://accounts.example.com/.well-known/openid-configuration",
  };
  const oidcProvider = {
    providerId: "oidc",
    clientId: "oidc-client-id",
    clientSecret: "oidc-client-secret",
    discoveryUrl: "https://oidc.example.com/.well-known/openid-configuration",
  };

  it("should combine custom and environment providers", () => {
    expect(
      createGenericOAuthConfig(false, [customProvider], oidcProvider),
    ).toEqual([customProvider, oidcProvider]);
  });

  it("should apply the global signup restriction to every provider", () => {
    expect(
      createGenericOAuthConfig(true, [customProvider], oidcProvider),
    ).toEqual([
      { ...customProvider, disableSignUp: true },
      { ...oidcProvider, disableSignUp: true },
    ]);
  });

  it("should reject duplicate provider identifiers", () => {
    expect(() =>
      createGenericOAuthConfig(
        false,
        [{ ...customProvider, providerId: "oidc" }],
        oidcProvider,
      ),
    ).toThrow('Generic OAuth provider ID "oidc" is configured more than once.');
  });
});
