import type { HashService } from "@nest-boot/hash";
import type { Mailer } from "@nest-boot/mailer";

import { createEmailAndPasswordConfig as createEmailAndPasswordConfigWithMailer } from "./create-email-and-password-config.js";

const sendMail = vi.fn().mockResolvedValue(undefined);
const mailer = { sendMail } as unknown as Mailer;
const hash = vi.fn();
const verify = vi.fn();
const hashService = { hash, verify } as unknown as HashService;

function createEmailAndPasswordConfig(
  disableSignUp: boolean,
  options?: Parameters<typeof createEmailAndPasswordConfigWithMailer>[2],
) {
  return createEmailAndPasswordConfigWithMailer(
    disableSignUp,
    mailer,
    hashService,
    options,
  );
}

describe("createEmailAndPasswordConfig", () => {
  beforeEach(() => {
    sendMail.mockClear();
    hash.mockReset();
    verify.mockReset();
    delete process.env.AUTH_DISABLE_SIGN_UP;
    delete process.env.AUTH_EMAIL_DISABLE_SIGN_UP;
    delete process.env.AUTH_EMAIL_ENABLED;
    delete process.env.AUTH_EMAIL_REQUIRE_VERIFICATION;
  });

  it("should enable email auth when AUTH_EMAIL_ENABLED is unset", () => {
    expect(createEmailAndPasswordConfig(false)).toMatchObject({
      disableSignUp: false,
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: expect.any(Function),
    });
  });

  it("should enable email auth when AUTH_EMAIL_ENABLED is true", () => {
    process.env.AUTH_EMAIL_ENABLED = "true";

    expect(createEmailAndPasswordConfig(false)).toMatchObject({
      disableSignUp: false,
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: expect.any(Function),
    });
  });

  it("should disable email auth when AUTH_EMAIL_ENABLED is false", () => {
    process.env.AUTH_EMAIL_ENABLED = "false";

    expect(createEmailAndPasswordConfig(false)).toMatchObject({
      disableSignUp: false,
      enabled: false,
      requireEmailVerification: true,
      sendResetPassword: expect.any(Function),
    });
  });

  it("should disable signup when AUTH_EMAIL_DISABLE_SIGN_UP is true and AUTH_EMAIL_ENABLED is unset", () => {
    process.env.AUTH_EMAIL_DISABLE_SIGN_UP = "true";

    expect(createEmailAndPasswordConfig(false)).toMatchObject({
      disableSignUp: true,
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: expect.any(Function),
    });
  });

  it("should disable signup when the global disable flag is true and AUTH_EMAIL_ENABLED is unset", () => {
    process.env.AUTH_DISABLE_SIGN_UP = "true";

    expect(createEmailAndPasswordConfig(true)).toMatchObject({
      disableSignUp: true,
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: expect.any(Function),
    });
  });

  it("should disable signup when AUTH_EMAIL_DISABLE_SIGN_UP is true and email auth is configured", () => {
    process.env.AUTH_EMAIL_ENABLED = "true";
    process.env.AUTH_EMAIL_DISABLE_SIGN_UP = "true";

    expect(createEmailAndPasswordConfig(false)).toMatchObject({
      disableSignUp: true,
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: expect.any(Function),
    });
  });

  it("should merge with explicit email auth options", () => {
    process.env.AUTH_EMAIL_DISABLE_SIGN_UP = "true";

    expect(
      createEmailAndPasswordConfig(false, {
        enabled: true,
        maxPasswordLength: 128,
      }),
    ).toMatchObject({
      disableSignUp: true,
      enabled: true,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      sendResetPassword: expect.any(Function),
    });
  });

  it("should preserve explicit signup disable from email auth options", () => {
    expect(
      createEmailAndPasswordConfig(false, {
        disableSignUp: true,
        enabled: true,
      }),
    ).toMatchObject({
      disableSignUp: true,
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: expect.any(Function),
    });
  });

  it("should preserve explicit email auth enabled options when AUTH_EMAIL_ENABLED is unset", () => {
    expect(
      createEmailAndPasswordConfig(false, {
        enabled: false,
      }),
    ).toMatchObject({
      disableSignUp: false,
      enabled: false,
      requireEmailVerification: true,
      sendResetPassword: expect.any(Function),
    });
  });

  it("should preserve an explicit email verification opt-out", () => {
    expect(
      createEmailAndPasswordConfig(false, {
        enabled: true,
        requireEmailVerification: false,
      }),
    ).toMatchObject({
      disableSignUp: false,
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: expect.any(Function),
    });
  });

  it.each([
    ["true", false, true],
    ["false", true, false],
  ])(
    "should use AUTH_EMAIL_REQUIRE_VERIFICATION=%s over explicit options",
    (envValue, configuredValue, expectedValue) => {
      process.env.AUTH_EMAIL_REQUIRE_VERIFICATION = envValue;

      expect(
        createEmailAndPasswordConfig(false, {
          enabled: true,
          requireEmailVerification: configuredValue,
        }),
      ).toMatchObject({
        disableSignUp: false,
        enabled: true,
        requireEmailVerification: expectedValue,
        sendResetPassword: expect.any(Function),
      });
    },
  );

  it("should send password reset emails through the configured mailer", async () => {
    const config = createEmailAndPasswordConfig(false);
    const reset = {
      token: "reset-token",
      url: "https://app.example.com/api/auth/reset-password/reset-token",
      user: {
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        email: "user@example.com",
        emailVerified: true,
        id: "user-1",
        image: null,
        name: "Example User",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    };

    await config.sendResetPassword?.(reset, undefined);

    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledWith({
      subject: "Reset your password",
      text: `Click the link to reset your password: ${reset.url}`,
      to: "user@example.com",
    });
  });

  it("should preserve an explicitly configured password reset sender", async () => {
    const sendResetPassword = vi.fn().mockResolvedValue(undefined);
    const config = createEmailAndPasswordConfig(false, {
      enabled: true,
      sendResetPassword,
    });
    const reset = {
      token: "reset-token",
      url: "https://app.example.com/reset-password",
      user: {
        createdAt: new Date(),
        email: "user@example.com",
        emailVerified: true,
        id: "user-1",
        name: "Example User",
        updatedAt: new Date(),
      },
    };

    await config.sendResetPassword?.(reset, undefined);

    expect(sendResetPassword).toHaveBeenCalledWith(reset, undefined);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("should hash and verify passwords through the injected hash service", async () => {
    hash.mockResolvedValue("argon2-hash");
    verify.mockResolvedValue(true);
    const password = createEmailAndPasswordConfig(false).password;

    await expect(password?.hash?.("plain-password")).resolves.toBe(
      "argon2-hash",
    );
    await expect(
      password?.verify?.({
        hash: "argon2-hash",
        password: "plain-password",
      }),
    ).resolves.toBe(true);

    expect(hash).toHaveBeenCalledWith("plain-password");
    expect(verify).toHaveBeenCalledWith("argon2-hash", "plain-password");
  });

  it("should preserve explicitly configured password functions", () => {
    const password = {
      hash: vi.fn(),
      verify: vi.fn(),
    };

    expect(createEmailAndPasswordConfig(false, { password }).password).toBe(
      password,
    );
  });
});
