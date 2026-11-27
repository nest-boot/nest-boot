/** Configures the optional storage download route. */
export interface StorageDownloadOptions {
  /** Mounts the download route and allows link signing. Defaults to true. */
  enabled?: boolean;

  /** Static route path under the Nest global prefix. Defaults to `/files/download`. */
  path?: string;

  /** Public origin serving the download route. Defaults to root-relative links. */
  baseURL?: string;

  /** Download token lifetime in seconds. Defaults to one hour. */
  expiresIn?: number;

  /** Optional decorator for the download controller, such as a public-route decorator. */
  controllerDecorator?: ClassDecorator;

  /** Overrides the response content type. Return null to disallow an object key. */
  resolveContentType?: (key: string) => string | null;
}
