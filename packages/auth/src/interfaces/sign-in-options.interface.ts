/** Options accepted when signing in with an email address and password. */
export interface SignInOptions {
  /** User email address. */
  email: string;
  /** Account password. */
  password: string;
  /** URL returned to the caller after successful authentication. */
  callbackURL?: string;
  /** Whether the created session should persist across browser restarts. */
  rememberMe?: boolean;
}
