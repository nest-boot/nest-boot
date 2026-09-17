import { Field, InputType } from "@nest-boot/graphql";
import { ZodField } from "@nest-boot/validator";

/**
 * Input for creating an API key.
 */
@InputType()
export class CreateApiKeyInput {
  /** API key display name. */
  @ZodField((z) => z.string().max(255))
  @Field(() => String)
  name!: string;

  /** API key expiration time; omitted or null means no expiration. */
  @ZodField((z) => z.date().nullish())
  @Field(() => Date, { nullable: true })
  expiresAt?: Date | null;

  /** Plaintext prefix: 1–32 lowercase letters or digits, starting with a letter. Defaults to sk. */
  @ZodField((z) => z.string().min(1).max(32).optional())
  @Field(() => String, { nullable: true })
  prefix?: string;

  /** API key permissions; null creates a key without permissions. */
  @ZodField((z) => z.array(z.string()).nullish())
  @Field(() => [String], { nullable: true })
  permissions?: string[] | null;
}
