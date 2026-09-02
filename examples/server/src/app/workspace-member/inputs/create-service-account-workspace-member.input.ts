import { Field, InputType } from '@nest-boot/graphql';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { GraphQLJSONObject } from 'graphql-type-json';

import { WorkspaceMemberRole } from '../enums/workspace-member-role.enum.js';

/** 创建服务账号成员的输入参数。 */
@InputType()
export class CreateServiceAccountWorkspaceMemberInput {
  /** 服务账号显示名称。 */
  @IsString()
  @MaxLength(255)
  @Field(() => String)
  name!: string;

  /** 服务账号角色，只允许管理员或普通成员。 */
  @IsOptional()
  @IsIn([WorkspaceMemberRole.MEMBER, WorkspaceMemberRole.ADMIN], {
    message: '角色必须是管理员或者成员',
  })
  @Field(() => WorkspaceMemberRole, { nullable: true })
  role?: WorkspaceMemberRole;

  /** 按资源和操作分组的服务账号权限。 */
  @IsOptional()
  @IsObject()
  @Field(() => GraphQLJSONObject, { nullable: true })
  permissions?: Record<string, string[]>;
}
