import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Password replacement performed by an administrator. */
@InputType()
export class SetUserPasswordInput {
  /** Replacement credential password. */
  @ZodField((z) => z.string())
  @Field(() => String)
  password!: string;
}
