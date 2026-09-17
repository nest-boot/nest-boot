/** Options for linking a social or OpenID Connect account. */
export interface LinkAuthSocialAccountOptions {
  /** Configured provider identifier. */
  provider: string;
  /** URL returned to after a successful provider callback. */
  callbackURL?: string;
  /** URL returned to after a failed provider callback. */
  errorCallbackURL?: string;
  /** Whether the provider authorization URL should be returned without redirecting. */
  disableRedirect?: boolean;
  /** Whether the provider may create a new account when linking cannot complete. */
  requestSignUp?: boolean;
  /** Additional OAuth scopes requested from the provider. */
  scopes?: string[];
  /** Optional provider login hint. */
  loginHint?: string;
  /** Additional provider authorization parameters. */
  additionalParams?: Record<string, string>;
  /** Application-defined data forwarded through the provider flow. */
  additionalData?: Record<string, unknown>;
}
