import { resolveRequiredOidcEnv } from "./resolve-required-oidc-env";

describe("resolveRequiredOidcEnv", () => {
  beforeEach(() => {
    delete process.env.AUTH_OIDC_CLIENT_ID;
  });

  it("should return the configured env value", () => {
    process.env.AUTH_OIDC_CLIENT_ID = "client-id";

    expect(resolveRequiredOidcEnv("AUTH_OIDC_CLIENT_ID")).toBe("client-id");
  });

  it.each([undefined, ""])("should reject missing values", (value) => {
    if (value === undefined) {
      delete process.env.AUTH_OIDC_CLIENT_ID;
    } else {
      process.env.AUTH_OIDC_CLIENT_ID = value;
    }

    expect(() => resolveRequiredOidcEnv("AUTH_OIDC_CLIENT_ID")).toThrow(
      "AUTH_OIDC_CLIENT_ID",
    );
  });
});
