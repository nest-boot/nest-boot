import '../../auth/enums/auth-permission.enum.js';

import { Field, InputType } from '@nest-boot/graphql';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { WorkspacePermission } from '../../auth/enums/workspace-permission.enum.js';
import { WorkspaceMemberRole } from '../enums/workspace-member-role.enum.js';
import { WorkspaceMemberStatus } from '../enums/workspace-member-status.enum.js';

/** 更新工作区成员的输入参数。 */
@InputType()
export class UpdateWorkspaceMemberInput {
  /** 成员显示名称。 */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Field(() => String, { nullable: true })
  name?: string;

  /** 成员邮箱。 */
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  @Field(() => String, { nullable: true })
  email?: string;

  /** 成员角色，只允许管理员或普通成员。 */
  @IsOptional()
  @IsIn([WorkspaceMemberRole.MEMBER, WorkspaceMemberRole.ADMIN], {
    message: '角色必须是管理员或者成员',
  })
  @Field(() => WorkspaceMemberRole, { nullable: true })
  role?: WorkspaceMemberRole;

  /** 额外授予成员的工作区域权限。 */
  @IsOptional()
  @IsArray()
  @IsEnum(WorkspacePermission, { each: true })
  @Field(() => [WorkspacePermission], { nullable: true })
  permissions?: WorkspacePermission[];

  /** 成员状态。 */
  @IsOptional()
  @IsIn(Object.values(WorkspaceMemberStatus), {
    message: '状态必须是有效的成员状态',
  })
  @Field(() => WorkspaceMemberStatus, { nullable: true })
  status?: WorkspaceMemberStatus;
}
