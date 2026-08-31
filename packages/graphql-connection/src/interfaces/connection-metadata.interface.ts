import { EntityClass, FilterQuery } from "@mikro-orm/core";
import type { ZodType } from "zod";

import { ConnectionFieldOptions } from "../types/field-options.type.js";

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
  fieldOptionsMap: Map<string, ConnectionFieldOptions<Entity>>;

  /**
   * Zod schema for validating and parsing filter queries.
   */
  filterQuerySchema: ZodType<FilterQuery<Entity>>;
}
