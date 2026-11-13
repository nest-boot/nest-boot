/** Result returned after requesting a password-reset link. */
export interface RequestPasswordResetResult {
  /** Whether the request was accepted. */
  status: boolean;
  /** Enumeration-safe message returned by the authentication backend. */
  message: string;
}
