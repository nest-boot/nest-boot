import { resolveSecret } from "./resolve-secret.js";

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
      }),
    ).toBe(secret);
  });

  it("should fall back to AUTH_SECRET and APP_SECRET env values", () => {
    process.env.AUTH_SECRET = secret;

    expect(resolveSecret({})).toBe(secret);

    delete process.env.AUTH_SECRET;
    process.env.APP_SECRET = secret;

    expect(resolveSecret({})).toBe(secret);
  });

  it("should reject missing, short, or low-entropy secrets", () => {
    expect(() => resolveSecret({})).toThrow("Auth secret is required");
    expect(() =>
      resolveSecret({
        secret: "short",
      }),
    ).toThrow("Auth secret must be at least 32 characters long");
    expect(() =>
      resolveSecret({
        secret: "a".repeat(32),
      }),
    ).toThrow("Auth secret appears low-entropy");
  });
});
