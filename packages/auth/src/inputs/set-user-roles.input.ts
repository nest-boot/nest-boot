import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Replaces application roles on a user. */
@InputType()
export class SetUserRolesInput {
  /** Complete replacement role list. */
  @ZodField((z) => z.array(z.string()))
  @Field(() => [String])
  roles!: string[];
}
