import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Deleted workspace identifier without relations to the deleted entity. */
@ObjectType()
export class DeleteWorkspacePayload {
  /** Identifier of the deleted workspace. */
  @Field(() => ID)
  id!: string;
}
