/** Configuration options for the temporary-directory module. */
export interface TemporaryDirectoryModuleOptions {
  /** Parent directory for request-scoped roots. Defaults to the system temp directory. */
  basePath?: string;
}
