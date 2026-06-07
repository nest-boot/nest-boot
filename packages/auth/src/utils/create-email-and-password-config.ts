import { isEnvTrue } from "./is-env-true";

export function createEmailAndPasswordConfig(disableSignUp: boolean) {
  return {
    enabled: process.env.AUTH_EMAIL_ENABLED !== "false",
    disableSignUp: disableSignUp || isEnvTrue("AUTH_EMAIL_DISABLE_SIGNUP"),
  };
}
