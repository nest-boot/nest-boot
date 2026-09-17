import { Field, InputType } from "@nest-boot/graphql";
import {
  IsArray,
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

/**
 * Input for creating an API key.
 */
@InputType()
export class CreateApiKeyInput {
  /** API key display name. */
  @IsString()
  @MaxLength(255)
  @Field(() => String)
  name!: string;

  /** API key expiration time; omitted or null means no expiration. */
  @IsOptional()
  @IsDate()
  @Field(() => Date, { nullable: true })
  expiresAt?: Date;

  /** Plaintext prefix: 1–32 lowercase letters or digits, starting with a letter. Defaults to sk. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Field(() => String, { nullable: true })
  prefix?: string;

  /** API key permissions. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  permissions?: string[];
}
