import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** User created through the user-management API. */
@InputType()
export class CreateUserInput {
  /** Email address for the new user. */
  @ZodField((z) => z.email())
  @Field(() => String)
  email!: string;

  /** Display name for the new user. */
  @ZodField((z) => z.string())
  @Field(() => String)
  name!: string;

  /** Initial credential password. */
  @ZodField((z) => z.string())
  @Field(() => String)
  password!: string;

  /** Initial application roles. */
  @ZodField((z) => z.array(z.string()).optional())
  @Field(() => [String], { nullable: true })
  roles?: string[];

  /** Direct user-administration permissions. */
  @ZodField((z) => z.array(z.string()).optional())
  @Field(() => [String], { nullable: true })
  permissions?: string[];
}
