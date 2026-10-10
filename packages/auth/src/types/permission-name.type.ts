import type { LowercaseIdentifier } from "./lowercase-identifier.type.js";

/** Validates lowercase `resource:action` segments with single hyphens, but no underscores. */
export type PermissionName<Value extends string> =
  Value extends `${infer Resource}:${infer Action}`
    ? Resource extends LowercaseIdentifier<Resource, "-">
      ? Action extends LowercaseIdentifier<Action, "-">
        ? Value
        : never
      : never
    : never;
