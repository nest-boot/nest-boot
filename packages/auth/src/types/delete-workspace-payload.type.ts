import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** 删除工作区后的返回结果，不再解析已删除实体的关联字段。 */
@ObjectType()
export class DeleteWorkspacePayload {
  /** 已删除工作区的唯一标识。 */
  @Field(() => ID)
  id!: string;
}
