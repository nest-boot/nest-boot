import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Created workspace identifier without workspace-scoped relations. */
@ObjectType()
export class CreateWorkspacePayload {
  /** Identifier of the created workspace. */
  @Field(() => ID)
  id!: string;
}
