/** Configures the optional storage download route. */
export interface StorageDownloadOptions {
  /** Mounts the download route and allows link signing. Defaults to true. */
  enabled?: boolean;

  /** Static route path under the Nest global prefix. Defaults to `/downloads`. */
  path?: string;

  /** Public origin serving the download route. Defaults to root-relative links. */
  baseURL?: string;

  /** Download token lifetime in seconds. Defaults to 86,400 (one day). */
  expiresIn?: number;

  /**
   * Class decorators applied to the download controller, defaulting to `[Public()]`.
   *
   * Supports both metadata decorators (such as `Public()` or `SkipThrottle()`) and
   * Nest enhancers (`@UseGuards`, `@UseInterceptors`, `@UsePipes`, `@UseFilters`).
   */
  decorators?: ClassDecorator[];

  /** Overrides the response content type. Return null to disallow an object key. */
  resolveContentType?: (key: string) => string | null;
}

/** Options for {@link StorageService.createFileDownloadUrl}. */
export interface StorageCreateFileDownloadUrlOptions {
  /** Identity for which the caller authorized the download (written to JWT `sub`). */
  subject: string;

  /** Overrides `download.expiresIn` for this link (in seconds, between 1 and 604800). */
  expiresIn?: number;
}
