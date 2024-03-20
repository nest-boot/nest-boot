import { Query, Resolver } from "@nestjs/graphql";

// 使用 GraphQL 必须有一个 root query
@Resolver()
export class TestResolver {
  @Query(() => String)
  test(): string {
    return "ok";
  }
}
