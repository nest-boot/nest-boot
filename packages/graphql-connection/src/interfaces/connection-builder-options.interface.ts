import type { EntityClass } from "@mikro-orm/core";
import type { FilterOptions } from "mikro-orm-filter-query-schema";

/**
 * Configuration options for the ConnectionBuilder.
 * @example
 * ```typescript
 * const options: ConnectionBuilderOptions = {
 *   filter: {
 *     maxDepth: 3,
 *     maxConditions: 10,
 *     maxOrBranches: 3,
 *     maxArrayLength: 50,
 *   },
 * };
 * ```
 */
export interface ConnectionBuilderOptions {
  /** Persistent entity used when the GraphQL node is a separate projection class. */
  entity?: EntityClass<object>;
  /**
   * Options for the filter query schema builder.
   * Controls limits on filter complexity to prevent abuse.
   */
  filter?: FilterOptions;
}
