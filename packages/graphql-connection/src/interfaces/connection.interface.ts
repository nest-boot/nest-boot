import { type PageInfo } from "../objects/index.js";
import { type EdgeInterface } from "./edge.interface.js";

/**
 * Represents a paginated connection following the Relay specification.
 *
 * A connection contains a list of edges (items with cursors), and pagination info.
 * @template T - The type of entities in the connection
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
}

/** Resolver source for a paginated connection. */
export type ConnectionResult<T> = ConnectionInterface<T>;
