import type { LowercaseIdentifier } from "./lowercase-identifier.type.js";

/** Validates a lowercase role literal with single hyphens, but no underscores. */
export type RoleName<Value extends string> = Value extends
  | "true"
  | "false"
  | "null"
  ? never
  : LowercaseIdentifier<Value, "-">;
