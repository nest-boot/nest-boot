import { hasSocialProviderEnvConfig } from "./has-social-provider-env-config.js";

const socialProviderIds = ["github", "google"] as const;
const socialProviderEnvCases = [
  ["github", "AUTH_GITHUB_CLIENT_ID"],
  ["github", "AUTH_GITHUB_CLIENT_SECRET"],
  ["github", "AUTH_GITHUB_DISABLE_SIGN_UP"],
  ["github", "AUTH_GITHUB_ENABLED"],
  ["google", "AUTH_GOOGLE_CLIENT_ID"],
  ["google", "AUTH_GOOGLE_CLIENT_SECRET"],
  ["google", "AUTH_GOOGLE_DISABLE_SIGN_UP"],
  ["google", "AUTH_GOOGLE_ENABLED"],
] as const;

describe("hasSocialProviderEnvConfig", () => {
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

  it.each(socialProviderIds)(
    "should return false when %s env is not configured",
    (provider) => {
      expect(hasSocialProviderEnvConfig(provider)).toBe(false);
    },
  );

  it.each(socialProviderEnvCases)(
    "should return true when %s env %s is configured",
    (provider, name) => {
      process.env[name] = "";

      expect(hasSocialProviderEnvConfig(provider)).toBe(true);
    },
  );
});
