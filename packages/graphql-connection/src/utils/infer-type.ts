export function inferType(
  value: string | number | bigint | boolean | Date,
): "string" | "number" | "bigint" | "boolean" | "date" {
  if (value instanceof Date) {
    return "date";
  }

  const typeOf = typeof value;

  if (["string", "number", "bigint", "boolean"].includes(typeOf)) {
    return typeOf as "string" | "number" | "boolean" | "bigint";
  }

  return "string";
}
