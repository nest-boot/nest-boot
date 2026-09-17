import { Field, InputType } from "@nest-boot/graphql";
import { IsBoolean, IsEmail, IsOptional, IsString } from "class-validator";

/** Fields an administrator can update directly. */
@InputType()
export class UpdateUserInput {
  /** Replacement email address. */
  @IsOptional()
  @IsEmail()
  @Field(() => String, { nullable: true })
  email?: string;

  /** Whether the replacement email is verified. */
  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, { nullable: true })
  emailVerified?: boolean;

  /** Replacement display name. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  name?: string;

  /** Replacement avatar URL, or null to clear it. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  image?: string | null;
}
