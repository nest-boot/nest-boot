import { hasSocialProviderCredentialEnvConfig } from "./has-social-provider-credential-env-config";

describe("hasSocialProviderCredentialEnvConfig", () => {
  beforeEach(() => {
    delete process.env.AUTH_GITHUB_CLIENT_ID;
    delete process.env.AUTH_GITHUB_CLIENT_SECRET;
    delete process.env.AUTH_GITHUB_DISABLE_SIGNUP;
    delete process.env.AUTH_GOOGLE_CLIENT_ID;
    delete process.env.AUTH_GOOGLE_CLIENT_SECRET;
    delete process.env.AUTH_GOOGLE_DISABLE_SIGNUP;
  });

  it("should return false when only disable signup env is configured", () => {
    process.env.AUTH_GOOGLE_DISABLE_SIGNUP = "true";

    expect(hasSocialProviderCredentialEnvConfig("google")).toBe(false);
  });

  it.each([
    ["github", "AUTH_GITHUB_CLIENT_ID"],
    ["github", "AUTH_GITHUB_CLIENT_SECRET"],
    ["google", "AUTH_GOOGLE_CLIENT_ID"],
    ["google", "AUTH_GOOGLE_CLIENT_SECRET"],
  ] as const)(
    "should return true when %s credential env %s is configured",
    (provider, name) => {
      process.env[name] = "";

      expect(hasSocialProviderCredentialEnvConfig(provider)).toBe(true);
    },
  );
});
