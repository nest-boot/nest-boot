import { createEmailAndPasswordConfig } from "./create-email-and-password-config";

describe("createEmailAndPasswordConfig", () => {
  beforeEach(() => {
    delete process.env.AUTH_EMAIL_DISABLE_SIGNUP;
    delete process.env.AUTH_EMAIL_ENABLED;
  });

  it("should preserve better-auth defaults when email auth is not configured", () => {
    expect(createEmailAndPasswordConfig(false)).toBeUndefined();
  });

  it("should enable email auth when AUTH_EMAIL_ENABLED is true", () => {
    process.env.AUTH_EMAIL_ENABLED = "true";

    expect(createEmailAndPasswordConfig(false)).toEqual({
      disableSignUp: false,
      enabled: true,
    });
  });

  it("should disable email auth when AUTH_EMAIL_ENABLED is false", () => {
    process.env.AUTH_EMAIL_ENABLED = "false";

    expect(createEmailAndPasswordConfig(false)).toEqual({
      disableSignUp: false,
      enabled: false,
    });
  });

  it("should not create email auth config for signup disable flags alone", () => {
    process.env.AUTH_EMAIL_DISABLE_SIGNUP = "true";

    expect(createEmailAndPasswordConfig(true)).toBeUndefined();
  });

  it("should disable signup when the global disable flag is true and email auth is configured", () => {
    process.env.AUTH_EMAIL_ENABLED = "true";

    expect(createEmailAndPasswordConfig(true)).toEqual({
      disableSignUp: true,
      enabled: true,
    });
  });

  it("should disable signup when AUTH_EMAIL_DISABLE_SIGNUP is true and email auth is configured", () => {
    process.env.AUTH_EMAIL_ENABLED = "true";
    process.env.AUTH_EMAIL_DISABLE_SIGNUP = "true";

    expect(createEmailAndPasswordConfig(false)).toEqual({
      disableSignUp: true,
      enabled: true,
    });
  });

  it("should merge with explicit email auth options", () => {
    process.env.AUTH_EMAIL_DISABLE_SIGNUP = "true";

    expect(
      createEmailAndPasswordConfig(false, {
        enabled: true,
        maxPasswordLength: 128,
      }),
    ).toEqual({
      disableSignUp: true,
      enabled: true,
      maxPasswordLength: 128,
    });
  });

  it("should preserve explicit signup disable from email auth options", () => {
    expect(
      createEmailAndPasswordConfig(false, {
        disableSignUp: true,
        enabled: true,
      }),
    ).toEqual({
      disableSignUp: true,
      enabled: true,
    });
  });
});
