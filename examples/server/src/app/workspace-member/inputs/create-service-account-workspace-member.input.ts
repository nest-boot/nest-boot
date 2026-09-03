import { Field, InputType } from '@nest-boot/graphql';
import {
  ArrayNotContains,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** 创建服务账号成员的输入参数。 */
@InputType()
export class CreateServiceAccountWorkspaceMemberInput {
  /** 服务账号显示名称。 */
  @IsString()
  @MaxLength(255)
  @Field(() => String)
  name!: string;

  /** 服务账号角色；不能直接创建所有者。 */
  @IsOptional()
  @IsArray()
  @ArrayNotContains(['owner'])
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  roles?: string[];

  /** 额外授予服务账号的工作区域权限。 */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  permissions?: string[];
}
