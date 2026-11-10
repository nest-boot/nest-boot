import { Query, Resolver } from "../src/index.js";

@Resolver()
export class TestResolver {
  @Query(() => String)
  test(): string {
    return "test";
  }
}
