import { resolveSocialProviderEnabled } from "./resolve-social-provider-enabled.js";

describe("resolveSocialProviderEnabled", () => {
  beforeEach(() => {
    delete process.env.AUTH_GOOGLE_ENABLED;
  });

  it("should return false when provider enabled env is unset", () => {
    expect(resolveSocialProviderEnabled("google")).toBe(false);
  });

  it.each([
    ["true", true],
    ["false", false],
    ["1", false],
  ] as const)("should parse %s as %s", (value, expected) => {
    process.env.AUTH_GOOGLE_ENABLED = value;

    expect(resolveSocialProviderEnabled("google")).toBe(expected);
  });
});
