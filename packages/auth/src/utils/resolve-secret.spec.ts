import { AuthModuleOptions } from "../auth-module-options.interface";
import { resolveSecret } from "./resolve-secret";

describe("resolveSecret", () => {
  const secret =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_abcdefghijklmnopqrstuvwxyz";

  beforeEach(() => {
    delete process.env.APP_SECRET;
    delete process.env.AUTH_SECRET;
  });

  it("should prefer the explicit module option", () => {
    process.env.AUTH_SECRET =
      "AUTHabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";

    expect(
      resolveSecret({
        secret,
      } as AuthModuleOptions),
    ).toBe(secret);
  });

  it("should fall back to AUTH_SECRET and APP_SECRET env values", () => {
    process.env.AUTH_SECRET = secret;

    expect(resolveSecret({} as AuthModuleOptions)).toBe(secret);

    delete process.env.AUTH_SECRET;
    process.env.APP_SECRET = secret;

    expect(resolveSecret({} as AuthModuleOptions)).toBe(secret);
  });

  it("should reject missing, short, or low-entropy secrets", () => {
    expect(() => resolveSecret({} as AuthModuleOptions)).toThrow(
      "Auth secret is required",
    );
    expect(() =>
      resolveSecret({
        secret: "short",
      } as AuthModuleOptions),
    ).toThrow("Auth secret must be at least 32 characters long");
    expect(() =>
      resolveSecret({
        secret: "a".repeat(32),
      } as AuthModuleOptions),
    ).toThrow("Auth secret appears low-entropy");
  });
});
