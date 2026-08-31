vi.mock("@nestjs/apollo", () => ({
  ApolloDriver: class ApolloDriver {},
  Plugin: class Plugin {},
}));

vi.mock("@nestjs/graphql", async () => {
  const { Module } =
    await vi.importActual<typeof import("@nestjs/common")>("@nestjs/common");
  const decorator = () => () => undefined;

  @Module({})
  class MockBaseGraphQLModule {
    static forRoot() {
      return { module: MockBaseGraphQLModule };
    }

    static forRootAsync() {
      return { module: MockBaseGraphQLModule };
    }
  }

  return {
    Args: decorator,
    Field: decorator,
    GraphQLModule: MockBaseGraphQLModule,
    InputType: decorator,
    Int: Number,
    Mutation: decorator,
    ObjectType: decorator,
    Query: decorator,
    registerEnumType: vi.fn(),
    ResolveField: decorator,
    Resolver: decorator,
  };
});

import { ArgsType } from "./decorators/args-type.decorator.js";
import { GraphQLModule } from "./graphql.module.js";
import * as publicApi from "./index.js";

describe("public API", () => {
  it("should expose local and upstream GraphQL helpers", () => {
    expect(publicApi.ArgsType).toBe(ArgsType);
    expect(publicApi.GraphQLModule).toBe(GraphQLModule);
    expect(publicApi.Plugin).toBeDefined();
    expect(publicApi.Query).toBeDefined();
  });
});
