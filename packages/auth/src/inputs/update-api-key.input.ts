import { Field, InputType } from "@nest-boot/graphql";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

/**
 * Input for updating an API key.
 */
@InputType()
export class UpdateApiKeyInput {
  /** New API key display name. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Field(() => String, { nullable: true })
  name?: string;

  /** Whether the API key can authenticate requests. */
  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, { nullable: true })
  enabled?: boolean;

  /** API key expiration time; null removes the expiration. */
  @IsOptional()
  @IsDate()
  @Field(() => Date, { nullable: true })
  expiresAt?: Date | null;

  /** API key permissions. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  permissions?: string[] | null;
}
