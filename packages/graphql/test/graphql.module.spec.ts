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

import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { GraphQLModule } from "../src/index.js";
import { TestResolver } from "./test.resolver.js";

describe("GraphQLModule", () => {
  let app: INestApplication;

  it(`GraphQLModule`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLModule],
      providers: [TestResolver],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });

  it(`GraphQLModule.forRoot`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLModule.forRoot({})],
      providers: [TestResolver],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });

  it(`GraphQLModule.forRootAsync`, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRootAsync({
          useFactory: () => ({}),
        }),
      ],
      providers: [TestResolver],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });
});
