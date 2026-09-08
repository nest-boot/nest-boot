/** Selects the scoped implementation used by a `Can` alias. */
export interface CanOptions {
  /** Authorization scope, defaulting to `WorkspaceCan`. */
  scope?: "user" | "workspace";
}
