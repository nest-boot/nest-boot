import { Field, ID, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Identifier input shared by user-management operations. */
@InputType()
export class UserIdInput {
  /** User identifier. */
  @ZodField((z) => z.string())
  @Field(() => ID)
  id!: string;
}
