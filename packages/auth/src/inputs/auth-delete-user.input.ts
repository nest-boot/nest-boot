import { Field, InputType } from "@nest-boot/graphql";
import { IsOptional, IsString } from "class-validator";

/** Current-user deletion input. */
@InputType()
export class AuthDeleteUserInput {
  /** URL used after deletion verification completes. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  callbackURL?: string;

  /** Current password when additional authorization is required. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  password?: string;

  /** Account-deletion verification token. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  token?: string;
}
