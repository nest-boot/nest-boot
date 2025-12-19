import { FilterQuery } from "@mikro-orm/core";

import { OrderInterface } from "./order.interface";

/**
 * Arguments for querying a paginated connection.
 *
 * Supports both forward pagination (first/after) and backward pagination (last/before),
 * as well as filtering, ordering, and search query functionality.
 *
 * @typeParam Entity - The entity type being queried
 *
 * @example Forward pagination
 * ```typescript
 * const args: ConnectionArgsInterface<User> = {
 *   first: 10,
 *   after: "cursor123",
 *   orderBy: { field: "CREATED_AT", direction: OrderDirection.DESC },
 * };
 * ```
 *
 * @example Backward pagination
 * ```typescript
 * const args: ConnectionArgsInterface<User> = {
 *   last: 10,
 *   before: "cursor456",
 * };
 * ```
 */
export interface ConnectionArgsInterface<Entity extends object> {
  /**
   * Returns elements after this cursor (for forward pagination).
   */
  after?: string;

  /**
   * Returns elements before this cursor (for backward pagination).
   */
  before?: string;

  /**
   * Returns up to the first n elements (for forward pagination).
   */
  first?: number;

  /**
   * Returns up to the last n elements (for backward pagination).
   */
  last?: number;

  /**
   * A search query string to filter results.
   * Parsed using search-syntax and applied to searchable fields.
   */
  query?: string;

  /**
   * A MongoDB-style filter query to apply to the results.
   */
  filter?: FilterQuery<Entity>;

  /**
   * Ordering options for the returned results.
   */
  orderBy?: OrderInterface<Entity>;
}
