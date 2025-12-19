import { FilterQuery } from "@mikro-orm/core";
import { GraphQLScalarType, Kind, ValueNode } from "graphql";
import {
  FieldOptions as FilterFieldOptions,
  FieldType,
  FilterOptions,
  FilterQuerySchemaBuilder,
} from "mikro-orm-filter-query-schema";

import { FieldOptions } from "../interfaces";

/**
 * The Zod schema type returned by FilterQuerySchemaBuilder.
 *
 * @typeParam Entity - The entity type for the filter
 */
export type FilterQuerySchema<Entity extends object> = ReturnType<
  FilterQuerySchemaBuilder<Entity>["build"]
>;

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

/**
 * The result of creating a filter scalar and schema.
 *
 * @typeParam Entity - The entity type for the filter
 */
export interface CreateFilterResult<Entity extends object> {
  /**
   * The GraphQL scalar type for the filter.
   */
  Filter: GraphQLScalarType<FilterQuery<Entity>>;

  /**
   * The Zod schema for validating filter queries.
   */
  filterQuerySchema: FilterQuerySchema<Entity>;
}

/**
 * Creates a GraphQL Filter scalar type and validation schema.
 *
 * The Filter scalar accepts MongoDB-style query syntax and validates
 * it against the configured field options.
 *
 * @typeParam Entity - The entity type being filtered
 * @param entityName - The name to use for the GraphQL scalar
 * @param fieldOptionsMap - Map of field configurations
 * @param filterOptions - Options for filter complexity limits
 * @returns An object containing the Filter scalar and filterQuerySchema
 *
 * @internal Used by ConnectionBuilder.build()
 */
export function createFilter<Entity extends object>(
  entityName: string,
  fieldOptionsMap: Map<string, FieldOptions<Entity, FieldType, string>>,
  filterOptions?: FilterOptions,
): CreateFilterResult<Entity> {
  const filterableFields = [...fieldOptionsMap.values()]
    .filter((field) => field.filterable !== false)
    .map((field) => field.field);

  const builder = new FilterQuerySchemaBuilder<Entity>(filterOptions);

  for (const [, options] of fieldOptionsMap) {
    if (options.filterable !== false) {
      builder.addField(
        options as FilterFieldOptions<Entity, FieldType, string>,
      );
    }
  }

  const filterQuerySchema = builder.build();

  const Filter = new GraphQLScalarType<FilterQuery<Entity>>({
    name: `${entityName}Filter`,
    description: `A filter for ${entityName} that accepts MongoDB query syntax.\nSupported fields: ${filterableFields.join(", ")}`,
    serialize: (value) => value as FilterQuery<Entity>,
    parseValue: (value) => {
      const parsed = parseJson(value);
      return filterQuerySchema.parse(parsed);
    },
    parseLiteral: (ast) => {
      const parsed = parseLiteralValue(ast);
      return filterQuerySchema.parse(parsed);
    },
  });

  return { Filter, filterQuerySchema };
}
