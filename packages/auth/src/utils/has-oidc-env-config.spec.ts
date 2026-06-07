import { hasOidcEnvConfig } from "./has-oidc-env-config";
import { OIDC_ENV_NAMES } from "./oidc.constants";

describe("hasOidcEnvConfig", () => {
  beforeEach(() => {
    delete process.env.AUTH_OIDC_CLIENT_ID;
    delete process.env.AUTH_OIDC_CLIENT_SECRET;
    delete process.env.AUTH_OIDC_DISCOVERY_URL;
    delete process.env.AUTH_OIDC_DISABLE_SIGNUP;
    delete process.env.AUTH_OIDC_PROMPT;
    delete process.env.AUTH_OIDC_SCOPES;
  });

  it("should return false when OIDC env is not configured", () => {
    expect(hasOidcEnvConfig()).toBe(false);
  });

  it.each(OIDC_ENV_NAMES)(
    "should return true when %s is configured",
    (name) => {
      process.env[name] = "";

      expect(hasOidcEnvConfig()).toBe(true);
    },
  );
});
