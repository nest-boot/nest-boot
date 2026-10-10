import type { User } from "../entities/user.entity.js";
import type { SignInSocialResult } from "./sign-in-social-result.interface.js";

/** Redirect or direct social sign-in result containing an application entity. */
export interface SignInSocialEntityResult extends Omit<
  SignInSocialResult,
  "user"
> {
  /** Authenticated application user, or null for a redirect-only result. */
  user: User | null;
}
