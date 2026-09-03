import type { Mailer } from "@nest-boot/mailer";
import type { BetterAuthOptions } from "better-auth";

type UserConfig = NonNullable<BetterAuthOptions["user"]>;

/** Adds Nest Boot's mailer-backed defaults to Better Auth user options. */
export function createUserConfig(
  mailer: Mailer,
  options?: UserConfig,
): UserConfig | undefined {
  if (!options?.changeEmail?.enabled) return options;
  if (options.changeEmail.sendChangeEmailConfirmation) return options;

  return {
    ...options,
    changeEmail: {
      ...options.changeEmail,
      sendChangeEmailConfirmation: async ({ newEmail, url, user }) => {
        await mailer.sendMail({
          to: user.email,
          subject: "Confirm your email change",
          text: [
            `Confirm changing your email address to ${newEmail}:`,
            url,
          ].join("\n\n"),
        });
      },
    },
  };
}
