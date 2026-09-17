import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** 创建工作区后的返回结果，不包含需要工作区上下文的关联字段。 */
@ObjectType()
export class CreateWorkspacePayload {
  /** 新建工作区的唯一标识。 */
  @Field(() => ID)
  id!: string;
}
