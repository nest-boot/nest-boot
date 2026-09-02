import type { Mailer } from "@nest-boot/mailer";
import type { BetterAuthOptions } from "better-auth";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";

type EmailVerificationConfig = NonNullable<
  BetterAuthOptions["emailVerification"]
>;
type EmailVerificationOptions = AuthModuleOptions["emailVerification"];

/** Creates the email verification configuration backed by the application mailer. */
export function createEmailVerificationConfig(
  mailer: Mailer,
  options?: EmailVerificationOptions,
): EmailVerificationConfig {
  const sendVerificationEmail: NonNullable<
    EmailVerificationConfig["sendVerificationEmail"]
  > = async ({ user, url }) => {
    await mailer.sendMail({
      to: user.email,
      subject: "Verify your email address",
      text: `Click the link to verify your email: ${url}`,
    });
  };

  return {
    ...options,
    sendVerificationEmail:
      options?.sendVerificationEmail ?? sendVerificationEmail,
  };
}
