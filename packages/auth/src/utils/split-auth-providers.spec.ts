import { splitAuthProviders } from "./split-auth-providers.js";

describe("splitAuthProviders", () => {
  it("should split built-in and custom providers", () => {
    const githubConfig = {
      clientId: "github-client-id",
      clientSecret: "github-client-secret",
    };

    expect(
      splitAuthProviders([
        { id: "github", ...githubConfig },
        {
          id: "company",
          name: "Company SSO",
          clientId: "company-client-id",
          clientSecret: "company-client-secret",
          discoveryUrl:
            "https://accounts.example.com/.well-known/openid-configuration",
        },
      ]),
    ).toEqual({
      socialProviders: { github: githubConfig },
      genericOAuthProviders: [
        {
          providerId: "company",
          name: "Company SSO",
          clientId: "company-client-id",
          clientSecret: "company-client-secret",
          discoveryUrl:
            "https://accounts.example.com/.well-known/openid-configuration",
        },
      ],
    });
  });

  it("should reject empty and duplicate provider identifiers", () => {
    expect(() =>
      splitAuthProviders([
        {
          id: " ",
          clientId: "client-id",
          discoveryUrl: "https://example.com",
        },
      ]),
    ).toThrow("Authentication provider ID must not be empty.");

    expect(() =>
      splitAuthProviders([
        {
          id: "github",
          clientId: "client-id",
          clientSecret: "client-secret",
        },
        {
          id: "github",
          clientId: "client-id",
          discoveryUrl: "https://example.com",
        },
      ]),
    ).toThrow(
      'Authentication provider ID "github" is configured more than once.',
    );
  });
});
