import { Field, InputType } from '@nest-boot/graphql';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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

  /** 成员状态。 */
  @IsOptional()
  @IsIn(Object.values(WorkspaceMemberStatus), {
    message: '状态必须是有效的成员状态',
  })
  @Field(() => WorkspaceMemberStatus, { nullable: true })
  status?: WorkspaceMemberStatus;
}
