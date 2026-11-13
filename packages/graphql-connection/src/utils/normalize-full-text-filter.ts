import { tokenizer } from "@nest-boot/database";

const filterOperators = new Set([
  "$and",
  "$or",
  "$not",
  "$some",
  "$none",
  "$every",
]);

/**
 * Segments full-text operands after parsing query syntax and resolving field paths.
 * Leaves comparison operands and non-plain objects intact.
 * @param value - Filter or nested filter group to normalize.
 * @returns Filter with full-text strings using the database tokenizer's word boundaries.
 * @internal
 */
export function normalizeFullTextFilter(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeFullTextFilter);
  }
  if (
    value === null ||
    typeof value !== "object" ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    return value;
  }

  // MikroORM raw SQL conditions use symbol keys.
  return Object.fromEntries(
    Reflect.ownKeys(value).map((key) => {
      const operand = (value as Record<PropertyKey, unknown>)[key];
      return [
        key,
        key === "$fulltext" && typeof operand === "string"
          ? tokenizer(operand).join(" ")
          : typeof key === "string" &&
              key.startsWith("$") &&
              !filterOperators.has(key)
            ? operand
            : normalizeFullTextFilter(operand),
      ];
    }),
  );
}
