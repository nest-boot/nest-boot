import { Field, InputType } from '@nest-boot/graphql';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 接受工作区邀请时可补充的成员信息。
 */
@InputType()
export class AcceptWorkspaceInviteInput {
  /** 接受邀请后使用的成员显示名称。 */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Field(() => String, { nullable: true })
  name?: string;
}
