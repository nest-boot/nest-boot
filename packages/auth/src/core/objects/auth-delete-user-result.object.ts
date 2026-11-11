import { Field, ObjectType } from "@nest-boot/graphql";

/** User deletion result. */
@ObjectType()
export class AuthDeleteUserResultType {
  /** Account-deletion result message. */
  @Field(() => String)
  message!: string;

  /** Whether the deletion request was accepted. */
  @Field(() => Boolean)
  success!: boolean;
}
