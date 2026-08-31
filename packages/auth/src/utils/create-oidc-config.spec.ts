import { createOidcConfig } from "./create-oidc-config.js";

describe("createOidcConfig", () => {
  beforeEach(() => {
    delete process.env.AUTH_OIDC_CLIENT_ID;
    delete process.env.AUTH_OIDC_CLIENT_SECRET;
    delete process.env.AUTH_OIDC_DISCOVERY_URL;
    delete process.env.AUTH_OIDC_DISABLE_SIGN_UP;
    delete process.env.AUTH_OIDC_ENABLED;
    delete process.env.AUTH_OIDC_PROMPT;
    delete process.env.AUTH_OIDC_SCOPES;
  });

  it("should return undefined when OIDC env is not configured", () => {
    expect(createOidcConfig(false)).toBeUndefined();
  });

  it("should return undefined when OIDC credentials are configured but AUTH_OIDC_ENABLED is unset", () => {
    process.env.AUTH_OIDC_CLIENT_ID = "client-id";
    process.env.AUTH_OIDC_CLIENT_SECRET = "client-secret";
    process.env.AUTH_OIDC_DISCOVERY_URL =
      "https://oidc.example.com/.well-known/openid-configuration";

    expect(createOidcConfig(false)).toBeUndefined();
  });

  it("should return undefined when AUTH_OIDC_ENABLED is false", () => {
    process.env.AUTH_OIDC_ENABLED = "false";
    process.env.AUTH_OIDC_CLIENT_ID = "client-id";
    process.env.AUTH_OIDC_CLIENT_SECRET = "client-secret";
    process.env.AUTH_OIDC_DISCOVERY_URL =
      "https://oidc.example.com/.well-known/openid-configuration";

    expect(createOidcConfig(false)).toBeUndefined();
  });

  it("should create OIDC config from env", () => {
    process.env.AUTH_OIDC_ENABLED = "true";
    process.env.AUTH_OIDC_CLIENT_ID = "client-id";
    process.env.AUTH_OIDC_CLIENT_SECRET = "client-secret";
    process.env.AUTH_OIDC_DISCOVERY_URL =
      "https://oidc.example.com/.well-known/openid-configuration";
    process.env.AUTH_OIDC_PROMPT = "login";
    process.env.AUTH_OIDC_SCOPES = "openid, email,";

    expect(createOidcConfig(false)).toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
      disableSignUp: false,
      discoveryUrl: "https://oidc.example.com/.well-known/openid-configuration",
      prompt: "login",
      providerId: "oidc",
      scopes: ["openid", "email"],
    });
  });

  it("should use default scopes and global signup disable", () => {
    process.env.AUTH_OIDC_ENABLED = "true";
    process.env.AUTH_OIDC_CLIENT_ID = "client-id";
    process.env.AUTH_OIDC_CLIENT_SECRET = "client-secret";
    process.env.AUTH_OIDC_DISCOVERY_URL =
      "https://oidc.example.com/.well-known/openid-configuration";

    expect(createOidcConfig(true)).toEqual(
      expect.objectContaining({
        disableSignUp: true,
        scopes: ["openid", "profile", "email"],
      }),
    );
  });

  it("should disable signup when AUTH_OIDC_DISABLE_SIGN_UP is true", () => {
    process.env.AUTH_OIDC_ENABLED = "true";
    process.env.AUTH_OIDC_CLIENT_ID = "client-id";
    process.env.AUTH_OIDC_CLIENT_SECRET = "client-secret";
    process.env.AUTH_OIDC_DISCOVERY_URL =
      "https://oidc.example.com/.well-known/openid-configuration";
    process.env.AUTH_OIDC_DISABLE_SIGN_UP = "true";

    expect(createOidcConfig(false)).toEqual(
      expect.objectContaining({
        disableSignUp: true,
      }),
    );
  });
});
