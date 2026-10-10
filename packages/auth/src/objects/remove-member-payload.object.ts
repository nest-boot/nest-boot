import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Removed member identifier without relations to the deleted entity. */
@ObjectType()
export class RemoveMemberPayload {
  /** Identifier of the removed member. */
  @Field(() => ID)
  id!: string;
}
