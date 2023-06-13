import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class PageInfo {
  @Field({ complexity: 0 })
  hasNextPage!: boolean;

  @Field({ complexity: 0 })
  hasPreviousPage!: boolean;

  @Field({ nullable: true, complexity: 0 })
  startCursor?: string;

  @Field({ nullable: true, complexity: 0 })
  endCursor?: string;
}
