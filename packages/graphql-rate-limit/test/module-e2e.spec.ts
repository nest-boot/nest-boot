import { GraphQLModule, Query, Resolver } from "@nest-boot/graphql";
import { type DynamicModule, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { GraphQLRateLimitModule } from "../src/graphql-rate-limit.module";

interface GraphQLResponse {
  data?: { hello: string };
  errors?: { message: string }[];
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
    };
  };
}

@Resolver()
class TestResolver {
  @Query(() => String)
  hello(): string {
    return "world";
  }
}

describe("GraphQLRateLimitModule - e2e", () => {
  const apps: INestApplication[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("applies configured default complexity to a real GraphQL request", async () => {
    const app = await createApp(
      GraphQLRateLimitModule.forRoot({
        maxComplexity: 8,
        defaultComplexity: 7,
        getId: () => "client",
      }),
    );
    apps.push(app);

    const response = await request(app.getHttpServer())
      .post("/api/graphql")
      .send({ query: "{ hello }" })
      .expect(200);
    const body = response.body as GraphQLResponse;

    expect(body.data).toEqual({ hello: "world" });
    expect(body.extensions?.cost).toMatchObject({
      requestedQueryCost: 7,
      actualQueryCost: 7,
    });
  });

  it("applies asynchronously configured maximum complexity", async () => {
    const app = await createApp(
      GraphQLRateLimitModule.forRootAsync({
        useFactory: () =>
          Promise.resolve({
            maxComplexity: 7,
            defaultComplexity: 7,
            getId: () => "client",
          }),
      }),
    );
    apps.push(app);

    const response = await request(app.getHttpServer())
      .post("/api/graphql")
      .send({ query: "{ hello }" })
      .expect(500);
    const body = response.body as GraphQLResponse;

    expect(body.data).toBeUndefined();
    expect(body.errors?.[0]?.message).toBe(
      "Query is too complex: 7. Maximum allowed complexity: 7",
    );
  });

  async function createApp(
    rateLimitModule: DynamicModule,
  ): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot({
          autoSchemaFile: true,
          playground: false,
        }),
        rateLimitModule,
      ],
      providers: [TestResolver],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    return app;
  }
});
