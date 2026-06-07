import { createEmailAndPasswordConfig } from "./create-email-and-password-config";

describe("createEmailAndPasswordConfig", () => {
  beforeEach(() => {
    delete process.env.AUTH_EMAIL_DISABLE_SIGNUP;
    delete process.env.AUTH_EMAIL_ENABLED;
  });

  it("should enable email auth and signup by default", () => {
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

  it("should disable signup when the global disable flag is true", () => {
    expect(createEmailAndPasswordConfig(true)).toEqual({
      disableSignUp: true,
      enabled: true,
    });
  });

  it("should disable signup when AUTH_EMAIL_DISABLE_SIGNUP is true", () => {
    process.env.AUTH_EMAIL_DISABLE_SIGNUP = "true";

    expect(createEmailAndPasswordConfig(false)).toEqual({
      disableSignUp: true,
      enabled: true,
    });
  });
});
