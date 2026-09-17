/** Options for creating a user through `UserService`. */
export interface CreateUserOptions {
  /** User email address. */
  email: string;
  /** User display name. */
  name: string;
  /** Initial credential password. */
  password: string;
  /** Initial user roles. Defaults to `user.defaultRole`. */
  roles?: string[];
  /** Initial permissions from the configured user permission catalog. */
  permissions?: string[];
}
