import type { Mailer } from "@nest-boot/mailer";
import type { BetterAuthOptions } from "better-auth";

import type { AuthModuleUserOptions } from "../auth-module-options.interface.js";

type UserConfig = NonNullable<BetterAuthOptions["user"]>;

/** Adds Nest Boot's mailer-backed defaults to Better Auth user options. */
export function createUserConfig(
  mailer: Mailer,
  options?: AuthModuleUserOptions,
): UserConfig | undefined {
  if (!options) return undefined;

  const config: UserConfig = {};
  if (options.additionalFields !== undefined) {
    config.additionalFields = options.additionalFields;
  }
  if (options.changeEmail !== undefined) {
    config.changeEmail = options.changeEmail;
  }
  if (options.deleteUser !== undefined) {
    config.deleteUser = options.deleteUser;
  }
  if (options.fields !== undefined) config.fields = options.fields;
  if (options.modelName !== undefined) config.modelName = options.modelName;
  if (options.validateUserInfo !== undefined) {
    config.validateUserInfo = options.validateUserInfo;
  }

  if (!config.changeEmail?.enabled) return config;
  if (config.changeEmail.sendChangeEmailConfirmation) return config;

  return {
    ...config,
    changeEmail: {
      ...config.changeEmail,
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
