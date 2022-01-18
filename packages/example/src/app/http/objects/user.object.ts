import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("User")
export class UserObject {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;
}
