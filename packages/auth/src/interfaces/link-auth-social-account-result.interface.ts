/** Provider authorization target returned when linking an account. */
export interface LinkAuthSocialAccountResult {
  /** Provider authorization URL. */
  url: string;
  /** Whether a browser client should navigate to {@link url}. */
  redirect: boolean;
}
