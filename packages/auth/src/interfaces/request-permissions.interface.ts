/**
 * Shared permission snapshot for one request identity.
 * @internal
 */
export interface RequestPermissions {
  readonly user: readonly string[];
  readonly workspace: readonly string[];
  /** Null means no credential ceiling: a session or an API key inheriting owner permissions. */
  readonly apiKey: readonly string[] | null;
}
