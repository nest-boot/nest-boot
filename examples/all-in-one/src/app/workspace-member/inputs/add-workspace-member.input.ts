import { Field, InputType } from '@nest-boot/graphql';
import { IsEmail } from 'class-validator';

/** 直接添加工作区成员的输入参数。 */
@InputType()
export class AddWorkspaceMemberInput {
  /** 待添加用户的邮箱。 */
  @IsEmail()
  @Field(() => String)
  email!: string;
}
