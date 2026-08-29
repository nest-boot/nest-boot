import { type TotalCountRelation } from "../enums";
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
   * The number of items matching the query (before pagination), capped at
   * 10,000. Use {@link totalCountRelation} to determine whether this value is
   * exact or a lower bound.
   */
  totalCount: number;

  /**
   * Indicates whether {@link totalCount} is exact or a lower bound.
   */
  totalCountRelation: TotalCountRelation;
}

/**
 * Resolver source returned by a selection-aware connection query.
 *
 * Count fields are omitted when neither field is selected by the GraphQL
 * operation. They remain non-null in the GraphQL schema and are populated
 * whenever either count field is selected.
 *
 * @typeParam T - The type of entities in the connection
 */
export type ConnectionResult<T> = Omit<
  ConnectionInterface<T>,
  "totalCount" | "totalCountRelation"
> &
  Partial<Pick<ConnectionInterface<T>, "totalCount" | "totalCountRelation">>;
