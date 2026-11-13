import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Social or generic OAuth provider enabled by the server. */
@ObjectType()
export class AuthSocialProviderType {
  /** Stable provider identifier. */
  @Field(() => ID)
  id!: string;

  /** Human-readable provider name. */
  @Field(() => String)
  name!: string;
}
