import { Query, Resolver } from "@nest-boot/graphql";

// 使用 GraphQL 必须有一个 root query
@Resolver()
export class TestResolver {
  @Query(() => String)
  test(): string {
    return "ok";
  }
}
