import type { AuthDeleteAccountVerificationData } from "./auth-delete-account-verification-data.interface.js";
import type { AuthUser } from "./auth-user.interface.js";

/** User-deletion lifecycle options. */
export interface AuthModuleDeleteUserOptions {
  /** Whether self-service user deletion is enabled. */
  enabled?: boolean;
  /** Sends an account-deletion verification message. */
  sendDeleteAccountVerification?: (
    data: AuthDeleteAccountVerificationData,
    request?: Request,
  ) => Promise<void>;
  /** Runs before coordinated user deletion. */
  beforeDelete?: (user: AuthUser, request?: Request) => Promise<void>;
  /** Runs after coordinated user deletion. */
  afterDelete?: (user: AuthUser, request?: Request) => Promise<void>;
  /** Account-deletion token lifetime in seconds. */
  deleteTokenExpiresIn?: number;
}
