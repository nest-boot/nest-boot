import { type PageInfo } from "../objects";
import { type EdgeInterface } from "./edge.interface";

/**
 * Represents a paginated connection following the Relay specification.
 *
 * A connection contains a list of edges (items with cursors), pagination info,
 * and the total count of items matching the query.
 *
 * @typeParam T - The type of entities in the connection
 *
 * @see {@link https://relay.dev/graphql/connections.htm | Relay Connection Specification}
 */
export interface ConnectionInterface<T> {
  /**
   * A list of edges, each containing a node and its cursor.
   */
  edges: EdgeInterface<T>[];

  /**
   * Information about the current page for pagination.
   */
  pageInfo: PageInfo;

  /**
   * The total number of items matching the query (before pagination).
   */
  totalCount: number;
}
