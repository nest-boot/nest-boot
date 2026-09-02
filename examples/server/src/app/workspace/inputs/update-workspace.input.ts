import { Field, InputType } from '@nest-boot/graphql';
import { IsOptional, IsString } from 'class-validator';

/**
 * 更新工作区的输入参数。
 */
@InputType()
export class UpdateWorkspaceInput {
  /** 新工作区名称。 */
  @IsString()
  @IsOptional()
  @Field(() => String, { nullable: true })
  name?: string;
}
