/** Password hashing callbacks used by email authentication. */
export interface AuthModulePasswordOptions {
  /** Hashes a plain-text password. Defaults to the injected HashService. */
  hash?: (password: string) => Promise<string>;
  /** Verifies a plain-text password against its stored hash. */
  verify?: (data: { hash: string; password: string }) => Promise<boolean>;
}
