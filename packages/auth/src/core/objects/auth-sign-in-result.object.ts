import { Field, ObjectType } from "@nest-boot/graphql";

import { User } from "../entities/user.entity.js";

/** Email sign-in result. */
@ObjectType()
export class AuthSignInResultType {
  /** Whether the caller should redirect. */
  @Field(() => Boolean)
  redirect!: boolean;

  /** Created session token. */
  @Field(() => String)
  token!: string;

  /** Optional redirect target. */
  @Field(() => String, { nullable: true })
  url!: string | null;

  /** Authenticated user. */

  @Field(() => User)
  user!: User;
}
