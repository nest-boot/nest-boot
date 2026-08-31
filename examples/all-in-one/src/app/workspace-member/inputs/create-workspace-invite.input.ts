import { Field, InputType } from '@nest-boot/graphql';
import { IsEmail, IsOptional } from 'class-validator';

import { WorkspaceMemberRole } from '../enums/workspace-member-role.enum.js';

/** 创建工作区邀请的输入参数。 */
@InputType()
export class CreateWorkspaceInviteInput {
  /** 被邀请成员加入后的角色。 */
  @Field(() => WorkspaceMemberRole)
  role!: WorkspaceMemberRole;

  /** 限制接受邀请的邮箱，为空时允许当前登录用户接受。 */
  @IsOptional()
  @IsEmail()
  @Field(() => String, { nullable: true })
  email?: string;
}
