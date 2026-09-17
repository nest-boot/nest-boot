import { Field, InputType, Int } from "@nest-boot/graphql";
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

/** Input for creating a workspace invitation. */
@InputType()
export class CreateInvitationInput {
  /** Roles granted to the invited member upon joining. */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Field(() => [String])
  roles!: string[];

  /** Email address authorized to accept the invitation. */
  @IsEmail()
  @Field(() => String)
  email!: string;

  /** Invitation lifetime in seconds. Defaults to 48 hours. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Field(() => Int, { nullable: true })
  expiresIn?: number;
}
