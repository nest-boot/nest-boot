import type { Mailer } from "@nest-boot/mailer";
import type { BetterAuthOptions } from "better-auth";

import type { AuthModuleUserOptions } from "../interfaces/auth-module-user-options.interface.js";

type UserConfig = NonNullable<BetterAuthOptions["user"]>;
type DeleteUser = (
  userId: string,
  beforeDelete?: () => Promise<void>,
) => Promise<void>;

/**
 * Adds Nest Boot's mailer-backed defaults to Better Auth user options.
 * @param mailer - Mailer used to deliver authentication emails.
 * @param options - Configuration for this operation.
 * @param deleteUser - Callback that removes the user and related records.
 * @returns Better Auth user options with email-change and deletion hooks.
 */
export function createUserConfig(
  mailer: Mailer,
  options?: AuthModuleUserOptions,
  deleteUser?: DeleteUser,
): UserConfig | undefined {
  if (!options) return undefined;

  const config: UserConfig = {};
  if (options.changeEmail !== undefined) {
    config.changeEmail = options.changeEmail;
  }
  if (options.deleteUser !== undefined) {
    const beforeDelete = options.deleteUser.beforeDelete;
    config.deleteUser = {
      ...options.deleteUser,
      ...(deleteUser
        ? {
            beforeDelete: async (user, request) => {
              await deleteUser(
                user.id,
                beforeDelete
                  ? async () => {
                      await beforeDelete(user, request);
                    }
                  : undefined,
              );
            },
          }
        : {}),
    };
  }

  if (!config.changeEmail && !config.deleteUser) return undefined;

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
