import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Input for directly adding a workspace member. */
@InputType()
export class AddMemberInput {
  /** Email address of the user to add. */
  @ZodField((z) => z.email())
  @Field(() => String)
  email!: string;
}
