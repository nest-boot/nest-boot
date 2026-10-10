/** Options for sending an email-verification link. */
export interface SendVerificationEmailOptions {
  /** Email address to verify. */
  email: string;
  /** URL used after email verification completes. */
  callbackURL?: string;
}
