import { Query, Resolver } from "../dist/index.js";

@Resolver()
export class TestResolver {
  @Query(() => String)
  test(): string {
    return "test";
  }
}
