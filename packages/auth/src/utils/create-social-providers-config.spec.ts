import { createSocialProvidersConfig } from "./create-social-providers-config";

describe("createSocialProvidersConfig", () => {
  beforeEach(() => {
    delete process.env.AUTH_GITHUB_CLIENT_ID;
    delete process.env.AUTH_GITHUB_CLIENT_SECRET;
    delete process.env.AUTH_GITHUB_DISABLE_SIGNUP;
    delete process.env.AUTH_GITHUB_ENABLED;
    delete process.env.AUTH_GOOGLE_CLIENT_ID;
    delete process.env.AUTH_GOOGLE_CLIENT_SECRET;
    delete process.env.AUTH_GOOGLE_DISABLE_SIGNUP;
    delete process.env.AUTH_GOOGLE_ENABLED;
  });

  it("should return undefined when provider env and options are not configured", () => {
    expect(createSocialProvidersConfig(false)).toBeUndefined();
  });

  it("should create Google and GitHub configs from env", () => {
    process.env.AUTH_GOOGLE_ENABLED = "true";
    process.env.AUTH_GOOGLE_CLIENT_ID = "google-client-id";
    process.env.AUTH_GOOGLE_CLIENT_SECRET = "google-client-secret";
    process.env.AUTH_GITHUB_ENABLED = "true";
    process.env.AUTH_GITHUB_CLIENT_ID = "github-client-id";
    process.env.AUTH_GITHUB_CLIENT_SECRET = "github-client-secret";

    expect(createSocialProvidersConfig(false)).toEqual({
      github: {
        clientId: "github-client-id",
        clientSecret: "github-client-secret",
        disableSignUp: false,
        enabled: true,
      },
      google: {
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
        disableSignUp: false,
        enabled: true,
      },
    });
  });

  it("should preserve custom providers from options", () => {
    expect(
      createSocialProvidersConfig(true, {
        apple: {
          clientId: "apple-client-id",
          clientSecret: "apple-client-secret",
        },
        google: {
          clientId: "google-client-id",
          clientSecret: "google-client-secret",
        },
      }),
    ).toEqual({
      apple: {
        clientId: "apple-client-id",
        clientSecret: "apple-client-secret",
      },
      google: {
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
        disableSignUp: true,
      },
    });
  });
});
