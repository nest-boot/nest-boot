import type { User } from "../entities/user.entity.js";
import type { SignInResult } from "./sign-in-result.interface.js";

/** Sign-in result containing the persisted application entity. */
export interface SignInEntityResult extends Omit<SignInResult, "user"> {
  /** The user represented by the newly issued request session. */
  user: User;
}
