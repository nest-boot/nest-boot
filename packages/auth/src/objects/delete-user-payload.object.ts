import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Deleted user identifier without relations to the deleted entity. */
@ObjectType()
export class DeleteUserPayload {
  /** Identifier of the deleted user. */
  @Field(() => ID)
  id!: string;
}
