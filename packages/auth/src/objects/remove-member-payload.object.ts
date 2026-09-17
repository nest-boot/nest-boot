import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** 移除成员后的返回结果，不再解析已删除实体的关联字段。 */
@ObjectType()
export class RemoveMemberPayload {
  /** 已移除成员的唯一标识。 */
  @Field(() => ID)
  id!: string;
}
