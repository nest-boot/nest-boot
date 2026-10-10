/** Options for resetting a credential password with a reset token. */
export interface ResetPasswordOptions {
  /** New password. */
  newPassword: string;
  /** Token issued by the password-reset flow. */
  token: string;
}
