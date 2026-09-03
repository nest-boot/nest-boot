import { Field, InputType } from '@nest-boot/graphql';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * 更新 API Key 的输入参数。
 */
@InputType()
export class UpdateApiKeyInput {
  /** API Key 新显示名称。 */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Field(() => String, { nullable: true })
  name?: string;

  /** 是否允许此 API Key 进行身份认证。 */
  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, { nullable: true })
  enabled?: boolean;

  /** API Key 过期时间；传入 null 表示移除过期时间。 */
  @IsOptional()
  @IsDate()
  @Field(() => Date, { nullable: true })
  expiresAt?: Date | null;

  /** API Key 权限。 */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  permissions?: string[] | null;
}
