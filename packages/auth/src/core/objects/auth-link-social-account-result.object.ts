import { Field, ObjectType } from "@nest-boot/graphql";

/** Provider authorization target returned when linking an account. */
@ObjectType()
export class AuthLinkSocialAccountResultType {
  /** Provider authorization URL. */
  @Field(() => String)
  url!: string;

  /** Whether the browser should navigate to the provider URL. */
  @Field(() => Boolean)
  redirect!: boolean;
}
