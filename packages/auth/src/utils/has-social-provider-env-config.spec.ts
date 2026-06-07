import { hasSocialProviderEnvConfig } from "./has-social-provider-env-config";

const socialProviderIds = ["github", "google"] as const;
const socialProviderEnvCases = [
  ["github", "AUTH_GITHUB_CLIENT_ID"],
  ["github", "AUTH_GITHUB_CLIENT_SECRET"],
  ["github", "AUTH_GITHUB_DISABLE_SIGNUP"],
  ["google", "AUTH_GOOGLE_CLIENT_ID"],
  ["google", "AUTH_GOOGLE_CLIENT_SECRET"],
  ["google", "AUTH_GOOGLE_DISABLE_SIGNUP"],
] as const;

describe("hasSocialProviderEnvConfig", () => {
  beforeEach(() => {
    delete process.env.AUTH_GITHUB_CLIENT_ID;
    delete process.env.AUTH_GITHUB_CLIENT_SECRET;
    delete process.env.AUTH_GITHUB_DISABLE_SIGNUP;
    delete process.env.AUTH_GOOGLE_CLIENT_ID;
    delete process.env.AUTH_GOOGLE_CLIENT_SECRET;
    delete process.env.AUTH_GOOGLE_DISABLE_SIGNUP;
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
