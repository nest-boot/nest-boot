import { Field, InputType, Int } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/** User-ban policy. */
@InputType()
export class BanUserInput {
  /** Optional reason recorded for the ban. */
  @ZodField((z) => z.string().max(255).optional())
  @Field(() => String, { nullable: true })
  reason?: string;

  /** Optional ban lifetime in seconds. */
  @ZodField((z) => z.number().int().min(1).optional())
  @Field(() => Int, { nullable: true })
  expiresIn?: number;
}
