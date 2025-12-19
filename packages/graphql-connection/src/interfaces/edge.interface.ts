/**
 * Represents an edge in a GraphQL connection.
 *
 * An edge contains a single item (node) and a cursor that can be used
 * for pagination to fetch items before or after this position.
 *
 * @typeParam T - The type of the node (entity) in the edge
 *
 * @see {@link https://relay.dev/graphql/connections.htm#sec-Edge-Types Relay Edge Type Specification}
 */
export interface EdgeInterface<T> {
  /**
   * The item at the end of this edge.
   */
  node: T;

  /**
   * A cursor for use in pagination.
   * Can be passed to `after` or `before` arguments.
   */
  cursor: string;
}
