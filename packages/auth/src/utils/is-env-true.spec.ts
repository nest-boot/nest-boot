import { isEnvTrue } from "./is-env-true";

describe("isEnvTrue", () => {
  beforeEach(() => {
    delete process.env.TEST_ENV_BOOLEAN;
  });

  it("should return true only when the env value is true", () => {
    process.env.TEST_ENV_BOOLEAN = "true";

    expect(isEnvTrue("TEST_ENV_BOOLEAN")).toBe(true);
  });

  it.each(["false", "1", "TRUE", ""])("should return false for %s", (value) => {
    process.env.TEST_ENV_BOOLEAN = value;

    expect(isEnvTrue("TEST_ENV_BOOLEAN")).toBe(false);
  });

  it("should return false when the env value is unset", () => {
    expect(isEnvTrue("TEST_ENV_BOOLEAN")).toBe(false);
  });
});
