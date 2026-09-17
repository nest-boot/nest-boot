/** Options for requesting a password-reset link. */
export interface RequestPasswordResetOptions {
  /** Email address that owns the credential password. */
  email: string;
  /** URL that receives the password-reset token. */
  redirectTo?: string;
}
