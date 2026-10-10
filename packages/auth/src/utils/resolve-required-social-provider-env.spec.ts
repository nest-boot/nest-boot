import { resolveRequiredSocialProviderEnv } from "./resolve-required-social-provider-env.js";

describe("resolveRequiredSocialProviderEnv", () => {
  beforeEach(() => {
    delete process.env.AUTH_GITHUB_CLIENT_ID;
    delete process.env.AUTH_GITHUB_CLIENT_SECRET;
    delete process.env.AUTH_GITHUB_DISABLE_SIGN_UP;
    delete process.env.AUTH_GITHUB_ENABLED;
    delete process.env.AUTH_GOOGLE_CLIENT_ID;
    delete process.env.AUTH_GOOGLE_CLIENT_SECRET;
    delete process.env.AUTH_GOOGLE_DISABLE_SIGN_UP;
    delete process.env.AUTH_GOOGLE_ENABLED;
  });

  it("should return the configured env value", () => {
    process.env.AUTH_GOOGLE_CLIENT_ID = "google-client-id";

    expect(resolveRequiredSocialProviderEnv("google", "clientId")).toBe(
      "google-client-id",
    );
  });

  it.each([undefined, ""])("should reject missing values", (value) => {
    if (value === undefined) {
      delete process.env.AUTH_GITHUB_CLIENT_SECRET;
    } else {
      process.env.AUTH_GITHUB_CLIENT_SECRET = value;
    }

    expect(() =>
      resolveRequiredSocialProviderEnv("github", "clientSecret"),
    ).toThrow("AUTH_GITHUB_CLIENT_SECRET");
  });
});
