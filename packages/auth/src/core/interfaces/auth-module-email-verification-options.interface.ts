import type { AuthSendVerificationEmail } from "../types/auth-send-verification-email.type.js";
import type { AuthUser } from "./auth-user.interface.js";

/** Email verification options owned by AuthModule. */
export interface AuthModuleEmailVerificationOptions {
  /** Custom verification sender. Defaults to the injected Mailer implementation. */
  sendVerificationEmail?: AuthSendVerificationEmail;
  /** Whether registration sends a verification email automatically. */
  sendOnSignUp?: boolean;
  /** Whether sign-in sends a verification email for an unverified address. */
  sendOnSignIn?: boolean;
  /** Whether successful verification creates a session automatically. */
  autoSignInAfterVerification?: boolean;
  /** Verification-token lifetime in seconds. */
  expiresIn?: number;
  /** Runs immediately before an email address is verified. */
  beforeEmailVerification?: (
    user: AuthUser,
    request?: Request,
  ) => Promise<void>;
  /** Runs after an email address has been verified. */
  afterEmailVerification?: (user: AuthUser, request?: Request) => Promise<void>;
}
