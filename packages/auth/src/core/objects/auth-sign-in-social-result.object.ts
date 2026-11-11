import { Field, ObjectType } from "@nest-boot/graphql";

import { User } from "../entities/user.entity.js";

/** Social or generic OAuth sign-in result. */
@ObjectType()
export class AuthSignInSocialResultType {
  /** Whether the browser should navigate to the provider URL. */
  @Field(() => Boolean)
  redirect!: boolean;

  /** Provider authorization URL for redirect flows. */
  @Field(() => String, { nullable: true })
  url!: string | null;

  /** Session token returned by direct token flows. */
  @Field(() => String, { nullable: true })
  token!: string | null;

  /** Authenticated user returned by direct token flows. */

  @Field(() => User, { nullable: true })
  user!: User | null;
}
