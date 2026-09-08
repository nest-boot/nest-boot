import type { BaseSession, BaseUser } from "../entities/index.js";

/** Authenticated application entities resolved from a session. */
export interface AuthenticatedSession<
  User extends BaseUser = BaseUser,
  Session extends BaseSession = BaseSession,
> {
  /** Persisted session entity. */
  session: Session;
  /** Persisted user entity. */
  user: User;
}
