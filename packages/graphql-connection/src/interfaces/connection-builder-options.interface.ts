import type { FilterOptions } from "mikro-orm-filter-query-schema";

/**
 * Configuration options for the ConnectionBuilder.
 *
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
  /**
   * Options for the filter query schema builder.
   * Controls limits on filter complexity to prevent abuse.
   */
  filter?: FilterOptions;
}
