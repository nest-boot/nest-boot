import { EntityClass, FilterQuery } from "@mikro-orm/core";
import type { FieldType } from "mikro-orm-filter-query-schema";
import type { ZodType } from "zod";

import { FieldOptions } from "../types/field-options.type";

/**
 * Metadata stored on connection classes for query building.
 *
 * This metadata is attached to connection classes using the
 * GRAPHQL_CONNECTION_METADATA symbol and is used by the
 * ConnectionQueryBuilder to construct queries.
 *
 * @typeParam Entity - The entity type for the connection
 * @internal
 */
export interface ConnectionMetadata<Entity extends object> {
  /**
   * The MikroORM entity class.
   */
  entityClass: EntityClass<Entity>;

  /**
   * Map of field names to their configuration options.
   */
  fieldOptionsMap: Map<string, FieldOptions<Entity, FieldType, string>>;

  /**
   * Zod schema for validating and parsing filter queries.
   */
  filterQuerySchema: ZodType<FilterQuery<Entity>>;
}
