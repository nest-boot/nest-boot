import { Field, InputType } from '@nest-boot/graphql';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { AuthPermissionEnum } from '../../auth/enums/auth-permission.enum.js';
import type { AuthPermission } from '../../auth/types/auth-permission.type.js';

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
  // eslint-disable-next-line @nest-boot/graphql-field-config-from-types
  @IsOptional()
  @IsArray()
  @IsEnum(AuthPermissionEnum, { each: true })
  @Field(() => [AuthPermissionEnum], { nullable: true })
  permissions?: AuthPermission[] | null;
}
