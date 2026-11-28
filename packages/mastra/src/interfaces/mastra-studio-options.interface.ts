export interface MastraStudioOptions {
  /**
   * Whether to mount Mastra Studio at `${prefix}/studio`.
   * Defaults to `true` when `server` is enabled, and `false` in headless mode.
   */
  enabled?: boolean;
  /** Whether to hide Mastra Cloud CTA links in Studio (default: `true`). */
  hideCloudCta?: boolean;
  /** Whether to disable Studio telemetry (default: `true`). */
  telemetryDisabled?: boolean;
}
