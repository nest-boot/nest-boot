import type { AuthSendResetPassword } from "../types/auth-send-reset-password.type.js";
import type { AuthModulePasswordOptions } from "./auth-module-password-options.interface.js";
import type { AuthUser } from "./auth-user.interface.js";

/** Email and password authentication options owned by AuthModule. */
export interface AuthModuleEmailAndPasswordOptions {
  /** Whether email and password authentication is enabled. Defaults to true. */
  enabled?: boolean;
  /** Whether new email/password registrations are disabled. */
  disableSignUp?: boolean;
  /** Whether users must verify their email before signing in. Defaults to true. */
  requireEmailVerification?: boolean;
  /** Maximum accepted password length. Defaults to 128. */
  maxPasswordLength?: number;
  /** Minimum accepted password length. Defaults to 8. */
  minPasswordLength?: number;
  /** Custom password reset sender. Defaults to the injected Mailer implementation. */
  sendResetPassword?: AuthSendResetPassword;
  /** Password-reset token lifetime in seconds. */
  resetPasswordTokenExpiresIn?: number;
  /** Runs after a password has been reset successfully. */
  onPasswordReset?: (
    data: { user: AuthUser },
    request?: Request,
  ) => Promise<void>;
  /** Password hashing and verification callbacks. */
  password?: AuthModulePasswordOptions;
  /** Whether a successful registration creates a session automatically. */
  autoSignIn?: boolean;
  /** Whether password reset revokes every existing session. */
  revokeSessionsOnPasswordReset?: boolean;
  /** Runs when registration is attempted for an existing email address. */
  onExistingUserSignUp?: (
    data: { user: AuthUser },
    request?: Request,
  ) => Promise<void>;
}
