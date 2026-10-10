import { Field, ID, ObjectType } from "@nest-boot/graphql";

/** Added member identifier without restricted relations. */
@ObjectType()
export class AddMemberPayload {
  /** Identifier of the affected resource. */
  @Field(() => ID)
  id!: string;
}
