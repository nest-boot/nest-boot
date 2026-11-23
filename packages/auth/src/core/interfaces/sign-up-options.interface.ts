/** Options accepted when signing up with an email address and password. */
export interface SignUpOptions {
  /** User display name. */
  name: string;
  /** Optional account handle; omitted or null leaves it unassigned. */
  username?: string | null;
  /** User email address. */
  email: string;
  /** Initial account password. */
  password: string;
  /** Optional user avatar URL. */
  image?: string;
  /** URL used after email verification completes. */
  callbackURL?: string;
  /** Whether the created session should persist across browser restarts. */
  rememberMe?: boolean;
}
