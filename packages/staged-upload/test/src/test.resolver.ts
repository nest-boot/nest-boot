import { Query, Resolver } from "@nest-boot/graphql";

// GraphQL requires at least one root query
@Resolver()
export class TestResolver {
  @Query(() => String)
  test(): string {
    return "ok";
  }
}
