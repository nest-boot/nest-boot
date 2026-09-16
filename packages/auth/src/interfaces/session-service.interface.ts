import { type Session } from "../entities/session.entity.js";
import { type User } from "../entities/user.entity.js";

/** Authenticated application entities resolved from a session. */
export interface AuthenticatedSession {
  /** Persisted session entity. */
  session: Session;
  /** Persisted user entity. */
  user: User;
}
