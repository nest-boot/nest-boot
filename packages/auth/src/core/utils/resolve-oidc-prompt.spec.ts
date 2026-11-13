import { resolveOidcPrompt } from "./resolve-oidc-prompt.js";

describe("resolveOidcPrompt", () => {
  beforeEach(() => {
    delete process.env.AUTH_OIDC_PROMPT;
  });

  it("should return undefined when AUTH_OIDC_PROMPT is unset", () => {
    expect(resolveOidcPrompt()).toBeUndefined();
  });

  it.each([
    "none",
    "login",
    "create",
    "consent",
    "select_account",
    "select_account consent",
    "login consent",
  ])("should return supported prompt %s", (prompt) => {
    process.env.AUTH_OIDC_PROMPT = prompt;

    expect(resolveOidcPrompt()).toBe(prompt);
  });

  it("should reject unsupported prompt values", () => {
    process.env.AUTH_OIDC_PROMPT = "invalid";

    expect(() => resolveOidcPrompt()).toThrow("AUTH_OIDC_PROMPT");
  });
});
