import type { Mailer } from "@nest-boot/mailer";

import { createEmailVerificationConfig } from "./create-email-verification-config.js";

const verification = {
  token: "verification-token",
  url: "https://app.example.com/api/auth/verify-email?token=verification-token",
  user: {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    email: "user@example.com",
    emailVerified: false,
    id: "user-1",
    image: null,
    name: "Example User",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
};

describe("createEmailVerificationConfig", () => {
  it("sends verification emails through the configured mailer", async () => {
    const sendMail = vi.fn().mockResolvedValue(undefined);
    const config = createEmailVerificationConfig({
      sendMail,
    } as unknown as Mailer);

    await config.sendVerificationEmail?.(verification, undefined);

    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledWith({
      subject: "Verify your email address",
      text: `Click the link to verify your email: ${verification.url}`,
      to: "user@example.com",
    });
  });

  it("preserves an explicitly configured sender and other options", async () => {
    const sendMail = vi.fn();
    const sendVerificationEmail = vi.fn().mockResolvedValue(undefined);
    const config = createEmailVerificationConfig(
      { sendMail } as unknown as Mailer,
      {
        sendOnSignUp: true,
        sendVerificationEmail,
      },
    );

    await config.sendVerificationEmail?.(verification, undefined);

    expect(config.sendOnSignUp).toBe(true);
    expect(sendVerificationEmail).toHaveBeenCalledWith(verification, undefined);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
