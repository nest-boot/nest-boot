import { Field, InputType } from '@nest-boot/graphql';
import { ArrayNotEmpty, IsArray, IsEmail, IsString } from 'class-validator';

/** 创建工作区邀请的输入参数。 */
@InputType()
export class CreateWorkspaceInvitationInput {
  /** 被邀请成员加入后的角色。 */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Field(() => [String])
  roles!: string[];

  /** 唯一允许接受邀请的邮箱。 */
  @IsEmail()
  @Field(() => String)
  email!: string;
}
