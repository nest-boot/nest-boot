/** Search, filter, ordering, and pagination accepted by the user list. */
export interface ListUsersOptions {
  /** Search field. */
  searchField?: "email" | "name";
  /** Search comparison. */
  searchOperator?: "contains" | "ends_with" | "starts_with";
  /** Search term. */
  searchValue?: string;
  /** Maximum number of users to return. */
  limit?: number;
  /** Number of users to skip. */
  offset?: number;
  /** Field used for ordering. */
  sortBy?: string;
  /** Ordering direction. */
  sortDirection?: "asc" | "desc";
  /** Field used for filtering. */
  filterField?: string;
  /** Filter comparison. */
  filterOperator?: "contains" | "eq" | "gt" | "gte" | "lt" | "lte" | "ne";
  /** Value used for filtering. */
  filterValue?: boolean | number | string;
}
