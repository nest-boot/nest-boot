import '../../auth/enums/auth-permission.enum.js';

import { Field, InputType } from '@nest-boot/graphql';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { WorkspacePermission } from '../../auth/enums/workspace-permission.enum.js';
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

  /** 额外授予服务账号的工作区域权限。 */
  @IsOptional()
  @IsArray()
  @IsEnum(WorkspacePermission, { each: true })
  @Field(() => [WorkspacePermission], { nullable: true })
  permissions?: WorkspacePermission[];
}
