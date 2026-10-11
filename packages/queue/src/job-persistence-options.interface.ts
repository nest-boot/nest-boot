/** Settings for persisted queue jobs. */
export interface JobPersistenceOptions {
  /** Enable persistence for opted-in queues and built-in job queries. Defaults to true. */
  enabled?: boolean;

  /** Retention in milliseconds, measured from the record's last update. Defaults to 30 days. */
  ttl?: number;
}
