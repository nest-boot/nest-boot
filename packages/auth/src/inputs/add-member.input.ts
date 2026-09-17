import { Field, InputType } from "@nest-boot/graphql";
import { IsEmail } from "class-validator";

/** Input for directly adding a workspace member. */
@InputType()
export class AddMemberInput {
  /** Email address of the user to add. */
  @IsEmail()
  @Field(() => String)
  email!: string;
}
