import { Field, InputType, Int } from "@nest-boot/graphql";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

/** User-ban policy. */
@InputType()
export class BanUserInput {
  /** Optional reason recorded for the ban. */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  reason?: string;

  /** Optional ban lifetime in seconds. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Field(() => Int, { nullable: true })
  expiresIn?: number;
}
