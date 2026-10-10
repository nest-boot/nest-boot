import type { HashService } from "@nest-boot/hash";
import type { Mailer } from "@nest-boot/mailer";
import type { BetterAuthOptions } from "better-auth";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { isEnvTrue } from "./is-env-true.js";

type EmailAndPasswordConfig = NonNullable<
  BetterAuthOptions["emailAndPassword"]
>;
type EmailAndPasswordOptions = AuthModuleOptions["emailAndPassword"];

/**
 * Returns email and password options with hashing and reset-email hooks.
 * @param disableSignUp - Whether provider-based registration is disabled.
 * @param mailer - Mailer used to deliver authentication emails.
 * @param hashService - Service for hashing and verifying passwords.
 * @param options - Configuration for this operation.
 * @returns Email and password options with hashing and reset-email hooks.
 */
export function createEmailAndPasswordConfig(
  disableSignUp: boolean,
  mailer: Mailer,
  hashService: HashService,
  options?: EmailAndPasswordOptions,
): EmailAndPasswordConfig {
  const hasEnabledEnv = process.env.AUTH_EMAIL_ENABLED !== undefined;
  const hasRequireVerificationEnv =
    process.env.AUTH_EMAIL_REQUIRE_VERIFICATION !== undefined;
  const shouldDisableSignUp =
    disableSignUp || isEnvTrue("AUTH_EMAIL_DISABLE_SIGN_UP");
  const enabled = hasEnabledEnv
    ? process.env.AUTH_EMAIL_ENABLED !== "false"
    : (options?.enabled ?? true);
  const requireEmailVerification = hasRequireVerificationEnv
    ? process.env.AUTH_EMAIL_REQUIRE_VERIFICATION !== "false"
    : (options?.requireEmailVerification ?? true);
  const sendResetPassword: NonNullable<
    EmailAndPasswordConfig["sendResetPassword"]
  > = async ({ user, url }) => {
    await mailer.sendMail({
      to: user.email,
      subject: "Reset your password",
      text: `Click the link to reset your password: ${url}`,
    });
  };
  const password: NonNullable<EmailAndPasswordConfig["password"]> = {
    hash: async (value) => await hashService.hash(value),
    verify: async ({ hash, password: value }) =>
      await hashService.verify(hash, value),
  };

  return {
    ...options,
    enabled,
    requireEmailVerification,
    sendResetPassword: options?.sendResetPassword ?? sendResetPassword,
    password: {
      hash: options?.password?.hash ?? password.hash,
      verify: options?.password?.verify ?? password.verify,
    },
    disableSignUp: shouldDisableSignUp || options?.disableSignUp === true,
  };
}
