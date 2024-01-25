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

  @Field(() => String, { nullable: true })
  startCursor!: string | null;

  @Field(() => String, { nullable: true })
  endCursor!: string | null;
}
