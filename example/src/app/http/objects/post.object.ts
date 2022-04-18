import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("Post")
export class PostObject {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  html: string;

  @Field()
  markdown: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
