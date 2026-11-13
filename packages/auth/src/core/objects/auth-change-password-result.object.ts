import { Field, ObjectType } from "@nest-boot/graphql";

/** Password change result. */
@ObjectType()
export class AuthChangePasswordResultType {
  /** Replacement session token when other sessions were revoked. */
  @Field(() => String, { nullable: true })
  token!: string | null;
}
