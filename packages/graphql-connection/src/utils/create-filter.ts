import { FilterQuery } from "@mikro-orm/core";
import { GraphQLScalarType, Kind, ValueNode } from "graphql";
import { z } from "zod";

import { UnknownFieldError } from "../errors";
import {
  FieldOptions,
  FilterOptions,
  ReplacementFieldOptions,
} from "../interfaces";

const comparisonOperators = [
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$in",
  "$nin",
  "$like",
  "$ilike",
  "$fulltext",
  "$contains",
  "$overlap",
] as const;

const logicalOperators = ["$and", "$or", "$not"] as const;

export type FilterValue = Record<string, unknown>;

function createComparisonSchema(): z.ZodType<unknown> {
  const primitiveSchema = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
  ]);

  const comparisonObjectSchema = z
    .object({
      $eq: primitiveSchema.optional(),
      $ne: primitiveSchema.optional(),
      $gt: z.union([z.string(), z.number()]).optional(),
      $gte: z.union([z.string(), z.number()]).optional(),
      $lt: z.union([z.string(), z.number()]).optional(),
      $lte: z.union([z.string(), z.number()]).optional(),
      $in: z.array(primitiveSchema).optional(),
      $nin: z.array(primitiveSchema).optional(),
      $like: z.string().optional(),
      $ilike: z.string().optional(),
      $fulltext: z.string().optional(),
      $contains: z.array(primitiveSchema).optional(),
      $overlap: z.array(primitiveSchema).optional(),
    })
    .strict();

  return z.union([primitiveSchema, comparisonObjectSchema]);
}

function createFilterSchema(): z.ZodType<unknown> {
  const comparisonSchema = createComparisonSchema();

  const baseFilterSchema: z.ZodType<unknown> = z.lazy(() =>
    z.union([
      z
        .object({
          $and: z.array(baseFilterSchema).optional(),
          $or: z.array(baseFilterSchema).optional(),
          $not: baseFilterSchema.optional(),
        })
        .catchall(comparisonSchema),
      z.record(z.string(), comparisonSchema),
    ]),
  );

  return baseFilterSchema;
}

const filterSchema = createFilterSchema();

function parseJson(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error("Filter must be a valid JSON string");
    }
  }
  return value;
}

function validateSchema(value: unknown): FilterValue {
  const result = filterSchema.safeParse(value);

  if (!result.success) {
    throw new Error(`Invalid filter: ${result.error.message}`);
  }

  return result.data as FilterValue;
}

function parseLiteralValue(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.ENUM:
      return ast.value;
    case Kind.OBJECT: {
      const obj: Record<string, unknown> = {};
      for (const field of ast.fields) {
        obj[field.name.value] = parseLiteralValue(field.value);
      }
      return obj;
    }
    case Kind.LIST:
      return ast.values.map(parseLiteralValue);
    case Kind.INT:
      return parseInt(ast.value, 10);
    case Kind.FLOAT:
      return parseFloat(ast.value);
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.NULL:
      return null;
    default:
      throw new Error(`Unexpected AST kind: ${ast.kind}`);
  }
}

function validateFilterFields(
  filter: FilterValue,
  fieldOptionsMap: Map<string, FieldOptions<object, any, any>>,
  inFieldComparison = false,
): void {
  if (filter === null || typeof filter !== "object") {
    return;
  }

  for (const key of Object.keys(filter)) {
    if (logicalOperators.includes(key as (typeof logicalOperators)[number])) {
      const value = filter[key];
      if (key === "$not" && value !== null && typeof value === "object") {
        validateFilterFields(value as FilterValue, fieldOptionsMap, false);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          validateFilterFields(item as FilterValue, fieldOptionsMap, false);
        }
      }
      continue;
    }

    if (
      comparisonOperators.includes(key as (typeof comparisonOperators)[number])
    ) {
      if (!inFieldComparison) {
        throw new Error(
          `Comparison operator '${key}' is not allowed at root level. Use it inside a field object, e.g., { "fieldName": { "${key}": value } }`,
        );
      }
      continue;
    }

    const fieldOptions = fieldOptionsMap.get(key);
    if (typeof fieldOptions === "undefined") {
      throw new UnknownFieldError(key);
    }

    if (fieldOptions.filterable === false) {
      throw new Error(`Field '${key}' is not filterable`);
    }

    const fieldValue = filter[key];
    if (
      fieldValue !== null &&
      typeof fieldValue === "object" &&
      !Array.isArray(fieldValue)
    ) {
      validateFilterFields(fieldValue as FilterValue, fieldOptionsMap, true);
    }
  }
}

function validateFilterSecurity(
  filter: FilterValue,
  options: Required<FilterOptions>,
  currentDepth = 0,
): number {
  if (filter === null || typeof filter !== "object") {
    return 0;
  }

  if (currentDepth > options.maxDepth) {
    throw new Error(
      `Filter nesting depth exceeds maximum of ${String(options.maxDepth)}`,
    );
  }

  let conditionCount = 0;

  for (const key of Object.keys(filter)) {
    const value = filter[key];

    if (options.disabledOperators.includes(key)) {
      throw new Error(`Operator '${key}' is disabled`);
    }

    if (key === "$or" && Array.isArray(value)) {
      if (value.length > options.maxOrBranches) {
        throw new Error(
          `$or branches (${String(value.length)}) exceed maximum of ${String(options.maxOrBranches)}`,
        );
      }
    }

    if (
      ["$in", "$nin", "$contains", "$overlap"].includes(key) &&
      Array.isArray(value)
    ) {
      if (value.length > options.maxArrayLength) {
        throw new Error(
          `Array in '${key}' (${String(value.length)}) exceeds maximum length of ${String(options.maxArrayLength)}`,
        );
      }
    }

    if (value !== null && typeof value === "object") {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== null && typeof item === "object") {
            conditionCount += validateFilterSecurity(
              item as FilterValue,
              options,
              currentDepth + 1,
            );
          }
        }
      } else {
        conditionCount += validateFilterSecurity(
          value as FilterValue,
          options,
          currentDepth + 1,
        );
      }
    }

    if (
      !logicalOperators.includes(key as (typeof logicalOperators)[number]) &&
      !comparisonOperators.includes(key as (typeof comparisonOperators)[number])
    ) {
      conditionCount++;
    }
  }

  if (currentDepth === 0 && conditionCount > options.maxConditions) {
    throw new Error(
      `Filter conditions (${String(conditionCount)}) exceed maximum of ${String(options.maxConditions)}`,
    );
  }

  return conditionCount;
}

function applyReplacement<Entity extends object>(
  filter: FilterValue,
  fieldOptionsMap: Map<string, FieldOptions<Entity, any, any>>,
): FilterQuery<Entity> {
  if (filter === null || typeof filter !== "object") {
    return filter as FilterQuery<Entity>;
  }

  const result: Record<string, unknown> = {};

  for (const key of Object.keys(filter)) {
    const value = filter[key];

    if (logicalOperators.includes(key as (typeof logicalOperators)[number])) {
      if (key === "$not" && value !== null && typeof value === "object") {
        result[key] = applyReplacement(value as FilterValue, fieldOptionsMap);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          applyReplacement(item as FilterValue, fieldOptionsMap),
        );
      } else {
        result[key] = value;
      }
      continue;
    }

    const fieldOptions = fieldOptionsMap.get(key);
    if (typeof fieldOptions !== "undefined") {
      const replacement = (fieldOptions as ReplacementFieldOptions<Entity>)
        .replacement;
      const targetKey =
        typeof replacement === "string" ? replacement : fieldOptions.field;

      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        result[targetKey] = applyReplacement(
          value as FilterValue,
          fieldOptionsMap,
        );
      } else {
        result[targetKey] = value;
      }
    } else {
      result[key] = value;
    }
  }

  return result as FilterQuery<Entity>;
}

export function createFilter<Entity extends object>(
  entityName: string,
  fieldOptionsMap: Map<string, FieldOptions<Entity, any, any>>,
  filterOptions: FilterOptions,
): GraphQLScalarType<FilterQuery<Entity>, FilterValue> {
  const filterableFields = [...fieldOptionsMap.values()]
    .filter((field) => field.filterable)
    .map((field) => field.field);

  return new GraphQLScalarType<FilterQuery<Entity>, FilterValue>({
    name: `${entityName}Filter`,
    description: `A filter for ${entityName} that accepts MongoDB query syntax.\nSupported fields: ${filterableFields.join(", ")}`,
    serialize: (value) => value as FilterValue,
    parseValue: (value) => {
      const parsed = parseJson(value);
      const validated = validateSchema(parsed);
      validateFilterSecurity(validated, filterOptions);
      validateFilterFields(
        validated,
        fieldOptionsMap as Map<string, FieldOptions<object, any, any>>,
      );
      return applyReplacement(validated, fieldOptionsMap);
    },
    parseLiteral: (ast) => {
      const parsed = parseLiteralValue(ast);
      const validated = validateSchema(parsed);
      validateFilterSecurity(validated, filterOptions);
      validateFilterFields(
        validated,
        fieldOptionsMap as Map<string, FieldOptions<object, any, any>>,
      );
      return applyReplacement(validated, fieldOptionsMap);
    },
  });
}
