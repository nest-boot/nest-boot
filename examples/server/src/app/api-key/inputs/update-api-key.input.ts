import { Field, InputType } from '@nest-boot/graphql';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 更新 API Key 的输入参数。
 */
@InputType()
export class UpdateApiKeyInput {
  /** API Key 新显示名称。 */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Field(() => String, { nullable: true })
  name?: string;
}
