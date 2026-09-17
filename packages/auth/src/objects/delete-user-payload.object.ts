import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** 删除用户后的返回结果，不再解析已删除实体的关联字段。 */
@ObjectType()
export class DeleteUserPayload {
  /** 已删除用户的唯一标识。 */
  @Field(() => ID)
  id!: string;
}
