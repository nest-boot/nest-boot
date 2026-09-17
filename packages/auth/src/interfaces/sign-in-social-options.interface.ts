/** Options accepted when starting a social or generic OAuth sign-in flow. */
export interface SignInSocialOptions {
  /** Configured provider identifier. */
  provider: string;
  /** URL returned to after a successful provider callback. */
  callbackURL?: string;
  /** URL returned to after a newly created user's provider callback. */
  newUserCallbackURL?: string;
  /** URL returned to after a failed provider callback. */
  errorCallbackURL?: string;
  /** Whether the provider authorization URL should be returned without redirecting. */
  disableRedirect?: boolean;
  /** Additional OAuth scopes requested from the provider. */
  scopes?: string[];
  /** Whether this flow may create a new user. */
  requestSignUp?: boolean;
  /** Optional provider login hint. */
  loginHint?: string;
  /** Additional provider authorization parameters. */
  additionalParams?: Record<string, string>;
  /** Application-defined data forwarded through the provider flow. */
  additionalData?: Record<string, unknown>;
}
