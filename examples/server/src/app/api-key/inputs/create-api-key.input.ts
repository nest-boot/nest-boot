import { Field, InputType } from '@nest-boot/graphql';
import {
  IsArray,
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * 创建 API Key 的输入参数。
 */
@InputType()
export class CreateApiKeyInput {
  /** API Key 显示名称。 */
  @IsString()
  @MaxLength(255)
  @Field(() => String)
  name!: string;

  /** API Key 过期时间；为空时表示不过期。 */
  @IsOptional()
  @IsDate()
  @Field(() => Date, { nullable: true })
  expiresAt?: Date;

  /** API Key 的明文前缀。 */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Field(() => String, { nullable: true })
  prefix?: string;

  /** API Key 权限。 */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  permissions?: string[];
}
