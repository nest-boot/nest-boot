/** PostgreSQL policy combination mode. */
export enum PolicyMode {
  /** Allows access when any permissive policy grants it. */
  PERMISSIVE = "permissive",
  /** Requires this policy to pass in addition to permissive policies. */
  RESTRICTIVE = "restrictive",
}
