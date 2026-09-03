import type { Mailer } from "@nest-boot/mailer";

import { createUserConfig } from "./create-user-config.js";

describe("createUserConfig", () => {
  it("adds a mailer-backed current-email confirmation sender", async () => {
    const sendMail = vi.fn().mockResolvedValue(undefined);
    const config = createUserConfig({ sendMail } as unknown as Mailer, {
      changeEmail: {
        enabled: true,
      },
    });

    await config?.changeEmail?.sendChangeEmailConfirmation?.(
      {
        newEmail: "next@example.com",
        token: "confirmation-token",
        url: "https://app.example.com/confirm-email-change",
        user: {
          createdAt: new Date(),
          email: "current@example.com",
          emailVerified: true,
          id: "user-1",
          image: null,
          name: "User",
          updatedAt: new Date(),
        },
      },
      undefined,
    );

    expect(sendMail).toHaveBeenCalledWith({
      subject: "Confirm your email change",
      text: [
        "Confirm changing your email address to next@example.com:",
        "https://app.example.com/confirm-email-change",
      ].join("\n\n"),
      to: "current@example.com",
    });
  });

  it("preserves a custom current-email confirmation sender", () => {
    const customSender = vi.fn();
    const config = createUserConfig({} as Mailer, {
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: customSender,
      },
    });

    expect(config?.changeEmail?.sendChangeEmailConfirmation).toBe(customSender);
  });

  it("does not enable change-email implicitly", () => {
    expect(createUserConfig({} as Mailer, undefined)).toBeUndefined();
    expect(createUserConfig({} as Mailer, {})).toEqual({});
  });

  it("passes only allowlisted Better Auth user options", () => {
    const buildAbility = vi.fn();
    const config = createUserConfig({} as Mailer, {
      buildAbility,
      modelName: "user",
      permissions: ["user:list"],
      roles: { admin: ["user:list"] },
    });

    expect(config).toEqual({ modelName: "user" });
    expect(config).not.toHaveProperty("buildAbility");
    expect(config).not.toHaveProperty("permissions");
    expect(config).not.toHaveProperty("roles");
  });
});
