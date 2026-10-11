/** Settings for persisted queue jobs. */
export interface JobPersistenceOptions {
  /** Persist this queue's local job events. Defaults to false. */
  enabled?: boolean;

  /** Retention in milliseconds from the last update. Overrides the module default (30 days if unset). */
  ttl?: number;
}
