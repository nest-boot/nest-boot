import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** 退出工作区后的返回结果，不再解析已删除成员的关联字段。 */
@ObjectType()
export class LeaveWorkspacePayload {
  /** 退出时被移除的成员标识，不是工作区标识。 */
  @Field(() => ID)
  memberId!: string;
}
