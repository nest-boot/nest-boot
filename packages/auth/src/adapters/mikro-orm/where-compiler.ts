import { raw } from "@mikro-orm/core";
import type { Where } from "better-auth/adapters";

type FieldNameResolver = (field: string) => string;

export function convertWhereToMikroOrm(
  where: Required<Where>[],
  resolveColumnName: FieldNameResolver = (field) => field,
  resolvePropertyName: FieldNameResolver = (field) => field,
) {
  const conditions = where.map(({ field, mode, operator, value }) => {
    const propertyName = resolvePropertyName(field);
    const isInsensitive =
      mode === "insensitive" &&
      (typeof value === "string" ||
        (Array.isArray(value) &&
          value.every((entry) => typeof entry === "string")));
    const queryField = isInsensitive
      ? raw("lower(??)", [resolveColumnName(field)])
      : propertyName;
    const queryValue = isInsensitive
      ? Array.isArray(value)
        ? value.map((entry) => entry.toLowerCase())
        : value.toLowerCase()
      : value;

    switch (operator) {
      case "eq":
        return { [queryField]: { $eq: queryValue } };
      case "ne":
        return { [queryField]: { $ne: queryValue } };
      case "lt":
        return { [propertyName]: { $lt: value } };
      case "lte":
        return { [propertyName]: { $lte: value } };
      case "gt":
        return { [propertyName]: { $gt: value } };
      case "gte":
        return { [propertyName]: { $gte: value } };
      case "in": {
        if (!Array.isArray(queryValue)) {
          throw new TypeError('Value must be an array for operator "in"');
        }

        return { [queryField]: { $in: queryValue } };
      }
      case "not_in": {
        if (!Array.isArray(queryValue)) {
          throw new TypeError('Value must be an array for operator "not_in"');
        }

        return { [queryField]: { $nin: queryValue } };
      }
      case "contains":
        assertString(queryValue);
        return { [queryField]: { $like: `%${queryValue}%` } };
      case "starts_with":
        assertString(queryValue);
        return { [queryField]: { $like: `${queryValue}%` } };
      case "ends_with":
        assertString(queryValue);
        return { [queryField]: { $like: `%${queryValue}` } };
      default:
        throw new Error(`Unsupported operator: ${String(operator)}`);
    }
  });

  const andConditions = conditions.filter(
    (_, index) => where[index].connector !== "OR",
  );
  const orConditions = conditions.filter(
    (_, index) => where[index].connector === "OR",
  );

  if (orConditions.length === 0) return { $and: andConditions };
  if (andConditions.length === 0) {
    return orConditions.length === 1 ? orConditions[0] : { $or: orConditions };
  }

  return { $and: [...andConditions, { $or: orConditions }] };
}

function assertString(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError("Value must be a string");
  }
}
