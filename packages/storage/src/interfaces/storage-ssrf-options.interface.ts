/** Configures SSRF protection when uploading files from external HTTP/HTTPS URLs. */
export interface StorageSsrfOptions {
  /**
   * Blocks private, loopback, link-local, and cloud-metadata IP addresses on external
   * URL fetches and redirects. Defaults to `true`.
   */
  enabled?: boolean;

  /**
   * Trusted hostname or IP glob patterns (matched case-insensitively via `picomatch`,
   * for example `["*.corp.internal", "10.0.0.5"]`) that may resolve to private or
   * loopback addresses while SSRF protection remains enabled.
   */
  allowedHosts?: string[];
}
