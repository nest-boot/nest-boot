import { createSocialProviderConfig } from "./create-social-provider-config";

describe("createSocialProviderConfig", () => {
  beforeEach(() => {
    delete process.env.AUTH_GITHUB_CLIENT_ID;
    delete process.env.AUTH_GITHUB_CLIENT_SECRET;
    delete process.env.AUTH_GITHUB_DISABLE_SIGNUP;
    delete process.env.AUTH_GOOGLE_CLIENT_ID;
    delete process.env.AUTH_GOOGLE_CLIENT_SECRET;
    delete process.env.AUTH_GOOGLE_DISABLE_SIGNUP;
  });

  it("should return undefined when provider env and options are not configured", () => {
    expect(createSocialProviderConfig("google", false)).toBeUndefined();
  });

  it("should create Google config from env", () => {
    process.env.AUTH_GOOGLE_CLIENT_ID = "google-client-id";
    process.env.AUTH_GOOGLE_CLIENT_SECRET = "google-client-secret";

    expect(createSocialProviderConfig("google", false)).toEqual({
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
      disableSignUp: false,
    });
  });

  it("should create GitHub config from env", () => {
    process.env.AUTH_GITHUB_CLIENT_ID = "github-client-id";
    process.env.AUTH_GITHUB_CLIENT_SECRET = "github-client-secret";
    process.env.AUTH_GITHUB_DISABLE_SIGNUP = "true";

    expect(createSocialProviderConfig("github", false)).toEqual({
      clientId: "github-client-id",
      clientSecret: "github-client-secret",
      disableSignUp: true,
    });
  });

  it("should merge options without dropping signup disable flags", () => {
    expect(
      createSocialProviderConfig("google", true, {
        clientId: "option-client-id",
        clientSecret: "option-client-secret",
        scope: ["email"],
      }),
    ).toEqual({
      clientId: "option-client-id",
      clientSecret: "option-client-secret",
      disableSignUp: true,
      scope: ["email"],
    });
  });

  it("should apply provider signup disable env without requiring env credentials when options are configured", () => {
    process.env.AUTH_GOOGLE_DISABLE_SIGNUP = "true";

    expect(
      createSocialProviderConfig("google", false, {
        clientId: "option-client-id",
        clientSecret: "option-client-secret",
      }),
    ).toEqual({
      clientId: "option-client-id",
      clientSecret: "option-client-secret",
      disableSignUp: true,
    });
  });

  it("should prefer provider env credentials over option credentials", () => {
    process.env.AUTH_GOOGLE_CLIENT_ID = "env-client-id";
    process.env.AUTH_GOOGLE_CLIENT_SECRET = "env-client-secret";

    expect(
      createSocialProviderConfig("google", false, {
        clientId: "option-client-id",
        clientSecret: "option-client-secret",
      }),
    ).toEqual({
      clientId: "env-client-id",
      clientSecret: "env-client-secret",
      disableSignUp: false,
    });
  });
});
