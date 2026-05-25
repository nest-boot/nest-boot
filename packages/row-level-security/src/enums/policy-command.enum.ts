/** PostgreSQL row-level security policy command targets. */
export enum PolicyCommand {
  /** Applies the policy to all supported commands. */
  ALL = "all",
  /** Applies the policy to SELECT statements. */
  SELECT = "select",
  /** Applies the policy to INSERT statements. */
  INSERT = "insert",
  /** Applies the policy to UPDATE statements. */
  UPDATE = "update",
  /** Applies the policy to DELETE statements. */
  DELETE = "delete",
}
