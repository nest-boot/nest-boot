import type { DataFilterBetweenValue } from "../types";

export const getDataFilterBetweenValue = (
  value: unknown,
): DataFilterBetweenValue => {
  if (Array.isArray(value)) {
    return [value[0], value[1]];
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    const record = value as Record<string, unknown>;

    if (Array.isArray(record.$between)) {
      return [record.$between[0], record.$between[1]];
    }

    return [record.$gte, record.$lte];
  }

  return typeof value === "undefined" || value === null || value === ""
    ? [undefined, undefined]
    : [value, undefined];
};
