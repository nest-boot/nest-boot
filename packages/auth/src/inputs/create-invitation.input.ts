import { Field, InputType, Int } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** Input for creating a workspace invitation. */
@InputType()
export class CreateInvitationInput {
  /** Roles granted to the invited member upon joining. */
  @ZodField((z) => z.array(z.string()).min(1))
  @Field(() => [String])
  roles!: string[];

  /** Email address authorized to accept the invitation. */
  @ZodField((z) => z.email())
  @Field(() => String)
  email!: string;

  /** Invitation lifetime in seconds. Defaults to 48 hours. */
  @ZodField((z) => z.number().int().min(1).optional())
  @Field(() => Int, { nullable: true })
  expiresIn?: number;
}
