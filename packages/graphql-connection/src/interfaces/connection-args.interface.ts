import { FilterQuery } from "@mikro-orm/core";

import { OrderInterface } from "./order.interface.js";

/**
 * Arguments for querying a paginated connection.
 *
 * Supports both forward pagination (first/after) and backward pagination (last/before),
 * as well as filtering, ordering, and search query functionality.
 * Provide exactly one of `first` or `last`. Use `after` with `first` or `before` with `last`.
 * Explicit `null` is treated as omission.
 * @template Entity - The entity type being queried
 * @example Forward pagination
 * ```typescript
 * const args: ConnectionArgsInterface<User> = {
 *   first: 10,
 *   after: "cursor123",
 *   orderBy: { field: "createdAt", direction: OrderDirection.DESC },
 * };
 * ```
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
  after?: string | null;

  /**
   * Returns elements before this cursor (for backward pagination).
   */
  before?: string | null;

  /**
   * Returns up to the first n elements (for forward pagination). Use 1 to 100.
   */
  first?: number | null;

  /**
   * Returns up to the last n elements (for backward pagination). Use 1 to 100.
   */
  last?: number | null;

  /**
   * A search query string to filter results.
   * Parsed using search-syntax and applied to searchable fields.
   */
  query?: string | null;

  /**
   * A MongoDB-style filter query to apply to the results.
   */
  filter?: FilterQuery<Entity> | null;

  /**
   * Ordering options for the returned results.
   */
  orderBy?: OrderInterface<Entity> | null;
}
