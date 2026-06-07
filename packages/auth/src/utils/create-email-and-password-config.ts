import { AuthModuleOptions } from "../auth-module-options.interface";
import { isEnvTrue } from "./is-env-true";

type EmailAndPasswordConfig = NonNullable<
  AuthModuleOptions["emailAndPassword"]
>;

export function createEmailAndPasswordConfig(
  disableSignUp: boolean,
  options?: EmailAndPasswordConfig,
): EmailAndPasswordConfig | undefined {
  const hasEnabledEnv = process.env.AUTH_EMAIL_ENABLED !== undefined;
  const shouldDisableSignUp =
    disableSignUp || isEnvTrue("AUTH_EMAIL_DISABLE_SIGN_UP");

  if (!options && !hasEnabledEnv) {
    return undefined;
  }

  return {
    ...(options ?? {
      enabled: process.env.AUTH_EMAIL_ENABLED !== "false",
    }),
    ...(hasEnabledEnv
      ? { enabled: process.env.AUTH_EMAIL_ENABLED !== "false" }
      : {}),
    disableSignUp: shouldDisableSignUp || options?.disableSignUp === true,
  };
}
