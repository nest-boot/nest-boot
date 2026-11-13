import type { AuthUserData } from "./auth-user-data.interface.js";

/** Result returned after signing up with email and password. */
export interface SignUpResult<User extends AuthUserData = AuthUserData> {
  /** Session token, or `null` when registration does not create a session. */
  token: string | null;
  /** Newly created user. */
  user: User;
}
