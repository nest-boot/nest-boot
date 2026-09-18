/** Shared permission snapshot for one request identity. @internal */
export interface RequestPermissions {
  readonly user: readonly string[];
  readonly workspace: readonly string[];
  /** Null means a session credential; an empty array is an API key with no grants. */
  readonly apiKey: readonly string[] | null;
}
