import { Field, InputType } from "@nest-boot/graphql";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

import { MemberStatus } from "../enums/member-status.enum.js";

/** 更新工作区成员的输入参数。 */
@InputType()
export class UpdateMemberInput {
  /** 工作区内共享的成员名称，不修改用户个人资料。 */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Field(() => String, { nullable: true })
  name?: string;

  /** 工作区内共享的联系邮箱，不修改登录邮箱；null 表示清除。 */
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  @Field(() => String, { nullable: true })
  email?: string | null;

  /** 成员状态。 */
  @IsOptional()
  @IsIn(Object.values(MemberStatus), {
    message: "状态必须是有效的成员状态",
  })
  @Field(() => MemberStatus, { nullable: true })
  status?: MemberStatus;
}
