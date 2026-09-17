import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Replaces the roles assigned to a workspace member. */
@InputType()
export class SetMemberRolesInput {
  /** Complete replacement role list; ownership uses the transfer flow. */
  @ZodField((z) => z.array(z.string()).min(1))
  @Field(() => [String])
  roles!: string[];
}
