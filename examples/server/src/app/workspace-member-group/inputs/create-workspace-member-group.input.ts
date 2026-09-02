import { Field, InputType } from '@nest-boot/graphql';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

import { WorkspaceMemberPermission } from '../../workspace-member/workspace-member-permission.enum.js';

/** 创建工作区成员组的输入参数。 */
@InputType()
export class CreateWorkspaceMemberGroupInput {
  /** 成员组名称。 */
  @IsString()
  @MaxLength(255)
  @Field(() => String)
  name!: string;

  /** 成员组描述。 */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  description?: string;

  /** 成员组授予的权限列表。 */
  @IsOptional()
  @IsArray()
  @Field(() => [WorkspaceMemberPermission], { nullable: true })
  permissions?: WorkspaceMemberPermission[];

  /** 创建时一并加入成员组的成员 ID 列表。 */
  @IsOptional()
  @IsArray()
  @Field(() => [String], { nullable: true })
  memberIds?: string[];
}
