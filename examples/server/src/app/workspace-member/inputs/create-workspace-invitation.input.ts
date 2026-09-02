import { Field, InputType } from '@nest-boot/graphql';
import { IsEmail } from 'class-validator';

import { WorkspaceMemberRole } from '../enums/workspace-member-role.enum.js';

/** 创建工作区邀请的输入参数。 */
@InputType()
export class CreateWorkspaceInvitationInput {
  /** 被邀请成员加入后的角色。 */
  @Field(() => WorkspaceMemberRole)
  role!: WorkspaceMemberRole;

  /** 唯一允许接受邀请的邮箱。 */
  @IsEmail()
  @Field(() => String)
  email!: string;
}
