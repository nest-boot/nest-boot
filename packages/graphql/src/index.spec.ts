import * as publicApi from ".";
import { ArgsType } from "./decorators/args-type.decorator";
import { GraphQLModule } from "./graphql.module";

describe("public API", () => {
  it("should expose local and upstream GraphQL helpers", () => {
    expect(publicApi.ArgsType).toBe(ArgsType);
    expect(publicApi.GraphQLModule).toBe(GraphQLModule);
    expect(publicApi.Plugin).toBeDefined();
    expect(publicApi.Query).toBeDefined();
  });
});
