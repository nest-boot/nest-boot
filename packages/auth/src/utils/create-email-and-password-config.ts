import { AuthModuleOptions } from "../auth-module-options.interface.js";
import { isEnvTrue } from "./is-env-true.js";

type EmailAndPasswordConfig = NonNullable<
  AuthModuleOptions["emailAndPassword"]
>;

export function createEmailAndPasswordConfig(
  disableSignUp: boolean,
  options?: EmailAndPasswordConfig,
): EmailAndPasswordConfig {
  const hasEnabledEnv = process.env.AUTH_EMAIL_ENABLED !== undefined;
  const shouldDisableSignUp =
    disableSignUp || isEnvTrue("AUTH_EMAIL_DISABLE_SIGN_UP");
  const enabled = hasEnabledEnv
    ? process.env.AUTH_EMAIL_ENABLED !== "false"
    : (options?.enabled ?? true);

  return {
    ...options,
    enabled,
    disableSignUp: shouldDisableSignUp || options?.disableSignUp === true,
  };
}
