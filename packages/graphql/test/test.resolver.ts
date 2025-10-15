import { Query, Resolver } from "../src";

@Resolver()
export class TestResolver {
  @Query(() => String)
  test(): string {
    return "test";
  }
}
