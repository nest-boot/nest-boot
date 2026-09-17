import { Field, InputType } from "@nest-boot/graphql";
import { IsOptional, IsString } from "class-validator";

/** Current-user profile update input. */
@InputType()
export class AuthUpdateUserInput {
  /** New user display name. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  name?: string;

  /** New avatar URL, or `null` to remove the avatar. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  image?: string | null;
}
