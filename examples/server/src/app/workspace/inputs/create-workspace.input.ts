import { Field, InputType } from '@nest-boot/graphql';
import { IsString } from 'class-validator';

/**
 * 创建工作区的输入参数。
 */
@InputType()
export class CreateWorkspaceInput {
  /** 工作区名称。 */
  @IsString()
  @Field(() => String)
  name!: string;
}
