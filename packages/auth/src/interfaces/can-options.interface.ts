/** Optional authorization-domain settings for `Can` checks. */
export interface CanOptions {
  /** Authorization domain, defaulting to the current workspace. */
  scope?: "user" | "workspace";
}
