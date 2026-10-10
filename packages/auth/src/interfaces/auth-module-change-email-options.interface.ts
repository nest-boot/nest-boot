import type { AuthChangeEmailConfirmationData } from "./auth-change-email-confirmation-data.interface.js";

/** Email-change lifecycle options. */
export interface AuthModuleChangeEmailOptions {
  /** Whether changing email addresses is enabled. */
  enabled: boolean;
  /** Sends confirmation to the current email address. */
  sendChangeEmailConfirmation?: (
    data: AuthChangeEmailConfirmationData,
    request?: Request,
  ) => Promise<void>;
  /** Allows an unverified user to replace its email without verification. */
  updateEmailWithoutVerification?: boolean;
}
