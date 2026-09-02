import { Field, ID, InputType } from '@nest-boot/graphql';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 创建 API Key 的输入参数。
 */
@InputType()
export class CreateApiKeyInput {
  /** API Key 显示名称。 */
  @IsString()
  @MaxLength(255)
  @Field(() => String)
  name!: string;

  /** 目标工作区成员标识；为空时默认为当前成员。 */
  @IsOptional()
  @Field(() => ID, { nullable: true })
  workspaceMemberId?: string;

  /** API Key 过期时间；为空时表示不过期。 */
  @IsOptional()
  @IsDate()
  @Field(() => Date, { nullable: true })
  expiresAt?: Date;
}
