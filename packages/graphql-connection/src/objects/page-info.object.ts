import { Field, ObjectType } from "@nest-boot/graphql";

/**
 * Provides information about pagination in a connection.
 *
 * PageInfo is used to determine whether more pages exist and to fetch
 * additional pages using cursor-based pagination.
 *
 * @see {@link https://relay.dev/graphql/connections.htm#sec-undefined.PageInfo Relay PageInfo Specification}
 *
 * @example Using pageInfo for pagination
 * ```typescript
 * const result = await connectionManager.find(UserConnection, { first: 10 });
 *
 * if (result.pageInfo.hasNextPage) {
 *   // Fetch next page using endCursor
 *   const nextPage = await connectionManager.find(UserConnection, {
 *     first: 10,
 *     after: result.pageInfo.endCursor,
 *   });
 * }
 * ```
 */
@ObjectType({
  description: `Returns information about pagination in a connection, in accordance with the [Relay specification](https://relay.dev/graphql/connections.htm#sec-undefined.PageInfo).`,
})
export class PageInfo {
  /**
   * Whether there are more pages to fetch following the current page.
   */
  @Field(() => Boolean, {
    complexity: 0,
    description: `Whether there are more pages to fetch following the current page.`,
  })
  hasNextPage!: boolean;

  /**
   * Whether there are any pages prior to the current page.
   */
  @Field(() => Boolean, {
    complexity: 0,
    description: `Whether there are any pages prior to the current page.`,
  })
  hasPreviousPage!: boolean;

  /**
   * The cursor of the first edge in the current page.
   * Can be used with `before` for backward pagination.
   */
  @Field(() => String, { nullable: true })
  startCursor!: string | null;

  /**
   * The cursor of the last edge in the current page.
   * Can be used with `after` for forward pagination.
   */
  @Field(() => String, { nullable: true })
  endCursor!: string | null;
}
