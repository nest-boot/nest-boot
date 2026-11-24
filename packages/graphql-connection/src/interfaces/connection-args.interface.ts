import { FilterQuery } from "@mikro-orm/core";

import { OrderInterface } from "./order.interface.js";

/** Search and filter inputs shared by a connection and its count. */
export interface CountArgsInterface<Entity extends object> {
  /** Search expression parsed with the connection's searchable fields. */
  query?: string | null;
  /** Structured filter applied to the results. */
  filter?: FilterQuery<Entity> | null;
}

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
export interface ConnectionArgsInterface<
  Entity extends object,
> extends CountArgsInterface<Entity> {
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
   * Ordering options for the returned results.
   */
  orderBy?: OrderInterface<Entity> | null;
}
