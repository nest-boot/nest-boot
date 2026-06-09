import { createEmailAndPasswordConfig } from "./create-email-and-password-config";

describe("createEmailAndPasswordConfig", () => {
  beforeEach(() => {
    delete process.env.AUTH_DISABLE_SIGN_UP;
    delete process.env.AUTH_EMAIL_DISABLE_SIGN_UP;
    delete process.env.AUTH_EMAIL_ENABLED;
  });

  it("should enable email auth when AUTH_EMAIL_ENABLED is unset", () => {
    expect(createEmailAndPasswordConfig(false)).toEqual({
      disableSignUp: false,
      enabled: true,
    });
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

  it("should disable signup when AUTH_EMAIL_DISABLE_SIGN_UP is true and AUTH_EMAIL_ENABLED is unset", () => {
    process.env.AUTH_EMAIL_DISABLE_SIGN_UP = "true";

    expect(createEmailAndPasswordConfig(false)).toEqual({
      disableSignUp: true,
      enabled: true,
    });
  });

  it("should disable signup when the global disable flag is true and AUTH_EMAIL_ENABLED is unset", () => {
    process.env.AUTH_DISABLE_SIGN_UP = "true";

    expect(createEmailAndPasswordConfig(true)).toEqual({
      disableSignUp: true,
      enabled: true,
    });
  });

  it("should disable signup when AUTH_EMAIL_DISABLE_SIGN_UP is true and email auth is configured", () => {
    process.env.AUTH_EMAIL_ENABLED = "true";
    process.env.AUTH_EMAIL_DISABLE_SIGN_UP = "true";

    expect(createEmailAndPasswordConfig(false)).toEqual({
      disableSignUp: true,
      enabled: true,
    });
  });

  it("should merge with explicit email auth options", () => {
    process.env.AUTH_EMAIL_DISABLE_SIGN_UP = "true";

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

  it("should preserve explicit email auth enabled options when AUTH_EMAIL_ENABLED is unset", () => {
    expect(
      createEmailAndPasswordConfig(false, {
        enabled: false,
      }),
    ).toEqual({
      disableSignUp: false,
      enabled: false,
    });
  });
});
