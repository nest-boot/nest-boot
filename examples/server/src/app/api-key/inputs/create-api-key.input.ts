import { Field, InputType } from '@nest-boot/graphql';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { AuthPermissionEnum } from '../../auth/enums/auth-permission.enum.js';
import type { AuthPermission } from '../../auth/types/auth-permission.type.js';

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
  // eslint-disable-next-line @nest-boot/graphql-field-config-from-types
  @IsOptional()
  @IsArray()
  @IsEnum(AuthPermissionEnum, { each: true })
  @Field(() => [AuthPermissionEnum], { nullable: true })
  permissions?: AuthPermission[];
}
