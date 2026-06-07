import { hasSocialProviderCredentialEnvConfig } from "./has-social-provider-credential-env-config";

describe("hasSocialProviderCredentialEnvConfig", () => {
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

  it("should return false when only disable signup env is configured", () => {
    process.env.AUTH_GOOGLE_DISABLE_SIGN_UP = "true";

    expect(hasSocialProviderCredentialEnvConfig("google")).toBe(false);
  });

  it("should return false when only enabled env is configured", () => {
    process.env.AUTH_GOOGLE_ENABLED = "true";

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
