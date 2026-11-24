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
    ArgsType: decorator,
    Extensions: decorator,
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

import { ArgsType, ObjectType } from "@nestjs/graphql";
import { GraphQLError } from "graphql";

import { GraphQLModule } from "./graphql.module.js";
import * as publicApi from "./index.js";

describe("public API", () => {
  it("should expose local and upstream GraphQL helpers", () => {
    expect(publicApi.ArgsType).toBe(ArgsType);
    expect(publicApi.ObjectType).toBe(ObjectType);
    expect(publicApi.GraphQLModule).toBe(GraphQLModule);
    expect(publicApi.Plugin).toBeDefined();
    expect(publicApi.Query).toBeDefined();
  });

  it("exposes an operation rejection error with HTTP 429", () => {
    const error = new publicApi.GraphQLTooManyRequestsError();

    expect(error).toBeInstanceOf(GraphQLError);
    expect(error.message).toBe("Too Many Requests");
    expect(error.extensions).toEqual({
      code: "TOO_MANY_REQUESTS",
      http: { status: 429 },
    });
  });

  it("exposes an input error with the supplied message and GraphQL code", () => {
    const error = new publicApi.GraphQLBadUserInputError("Invalid page size");

    expect(error).toBeInstanceOf(GraphQLError);
    expect(error.message).toBe("Invalid page size");
    expect(error.extensions).toEqual({ code: "BAD_USER_INPUT" });
  });

  it.each([
    {
      ErrorClass: publicApi.GraphQLForbiddenError,
      code: "FORBIDDEN",
      defaultMessage: "Forbidden",
    },
    {
      ErrorClass: publicApi.GraphQLUnauthenticatedError,
      code: "UNAUTHENTICATED",
      defaultMessage: "Unauthenticated",
    },
  ])(
    "exposes a $code GraphQL error",
    ({ ErrorClass, code, defaultMessage }) => {
      const error = new ErrorClass();

      expect(error).toBeInstanceOf(GraphQLError);
      expect(error.message).toBe(defaultMessage);
      expect(error.extensions).toEqual({ code });
      expect(new ErrorClass("Access denied").message).toBe("Access denied");
    },
  );
});
