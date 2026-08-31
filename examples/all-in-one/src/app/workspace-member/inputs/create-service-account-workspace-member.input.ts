import { Field, InputType } from '@nest-boot/graphql';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { WorkspaceMemberRole } from '../enums/workspace-member-role.enum.js';
import { WorkspaceMemberPermission } from '../workspace-member-permission.enum.js';

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

  /** 直接授予服务账号的权限列表。 */
  @IsOptional()
  @IsArray()
  @Field(() => [WorkspaceMemberPermission], { nullable: true })
  permissions?: WorkspaceMemberPermission[];
}
