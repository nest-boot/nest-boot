import type { User } from "../entities/user.entity.js";

/** One page returned by the user list. */
export interface ListUsersResult {
  /** User entities in result order. */
  users: User[];
  /** Total number of users matching the query. */
  total: number;
  /** Effective page size, or `null` when no limit was supplied. */
  limit: number | null;
  /** Effective offset, or `null` when no offset was supplied. */
  offset: number | null;
}
