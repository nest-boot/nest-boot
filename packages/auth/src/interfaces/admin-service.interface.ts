import type { BaseUser } from "../entities/index.js";

/** Options for creating a user through `AdminService`. */
export interface AdminCreateUserOptions {
  /** User email address. */
  email: string;
  /** User display name. */
  name: string;
  /** Initial credential password. */
  password: string;
  /** Initial user permissions. */
  permissions?: string[];
  /** Application-defined user fields. */
  data?: Record<string, unknown>;
}

/** Fields accepted when an administrator updates a user. */
export interface AdminUpdateUserOptions {
  /** New email address. */
  email?: string;
  /** Whether the email address has been verified. */
  emailVerified?: boolean;
  /** New avatar URL, or `null` to remove it. */
  image?: string | null;
  /** New display name. */
  name?: string;
  /** Replacement user permissions. */
  permissions?: string[];
  /** Application-defined user fields. */
  [field: string]: unknown;
}

/** Search, filter, ordering, and pagination accepted by the admin user list. */
export interface AdminListUsersOptions {
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

/** One page returned by the admin user list. */
export interface AdminListUsersResult<User extends BaseUser = BaseUser> {
  /** User entities in result order. */
  users: User[];
  /** Total number of users matching the query. */
  total: number;
  /** Effective page size, or `null` when no limit was supplied. */
  limit: number | null;
  /** Effective offset, or `null` when no offset was supplied. */
  offset: number | null;
}

/** Options for banning a user. */
export interface AdminBanUserOptions {
  /** Optional reason displayed for the ban. */
  banReason?: string;
  /** Optional ban duration in seconds; omission creates a permanent ban. */
  banExpiresIn?: number;
}

/** Client metadata stored when an administrator starts impersonation. */
export interface AdminImpersonationOptions {
  /** Client IP address. */
  ipAddress?: string;
  /** Client User-Agent value. */
  userAgent?: string;
}

/** Permission statements checked against a user's flattened permissions. */
export interface AdminHasPermissionOptions {
  /** Permission actions grouped by subject name. */
  permissions: Record<string, string[]>;
}
