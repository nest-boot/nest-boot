/**
 * Represents the pagination direction for cursor-based pagination.
 *
 * @internal Used by ConnectionQueryBuilder to determine query direction
 */
export enum PagingType {
  /**
   * Forward pagination using `first` and `after` arguments.
   * Fetches items after the cursor, moving towards the end of the list.
   */
  FORWARD = "FORWARD",

  /**
   * Backward pagination using `last` and `before` arguments.
   * Fetches items before the cursor, moving towards the start of the list.
   */
  BACKWARD = "BACKWARD",
}
