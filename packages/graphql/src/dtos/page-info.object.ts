import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType({
  description: `Returns information about pagination in a connection, in accordance with the [Relay specification](https://relay.dev/graphql/connections.htm#sec-undefined.PageInfo).`,
})
export class PageInfo {
  @Field({
    complexity: 0,
    description: `Whether there are more pages to fetch following the current page.`,
  })
  hasNextPage!: boolean;

  @Field({
    complexity: 0,
    description: `Whether there are any pages prior to the current page.`,
  })
  hasPreviousPage!: boolean;

  @Field({
    nullable: true,
    complexity: 0,
    description: `The cursor corresponding to the first node in edges.`,
  })
  startCursor?: string;

  @Field({
    nullable: true,
    complexity: 0,
    description: `The cursor corresponding to the last node in edges.`,
  })
  endCursor?: string;
}
