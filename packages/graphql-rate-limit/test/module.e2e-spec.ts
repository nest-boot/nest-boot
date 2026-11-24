import {
  Field,
  GraphQLModule,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "@nest-boot/graphql";
import { type DynamicModule, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { GraphQLRateLimitModule } from "../src/graphql-rate-limit.module.js";

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

@ObjectType()
class MutationDetails {
  @Field(() => String)
  message!: string;
}

@ObjectType()
class MutationPayload {
  @Field(() => String)
  status!: string;

  @Field(() => MutationDetails, { complexity: 2 })
  details!: MutationDetails;
}

@Resolver()
class TestResolver {
  @Query(() => String)
  hello(): string {
    return "world";
  }

  @Mutation(() => Boolean)
  updateStatus(): boolean {
    return true;
  }

  @Mutation(() => MutationPayload)
  updateRecord(): MutationPayload {
    return { status: "updated", details: { message: "saved" } };
  }

  @Mutation(() => Boolean, { complexity: 3 })
  updateWithExplicitCost(): boolean {
    return true;
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
      .post("/graphql")
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
      .post("/graphql")
      .send({ query: "{ hello }" })
      .expect(500);
    const body = response.body as GraphQLResponse;

    expect(body.data).toBeUndefined();
    expect(body.errors?.[0]?.message).toBe(
      "Query is too complex: 7. Maximum allowed complexity: 7",
    );
  });

  it.each([
    { label: "default", options: {}, baseCost: 10 },
    { label: "custom", options: { defaultMutationComplexity: 4 }, baseCost: 4 },
    { label: "zero", options: { defaultMutationComplexity: 0 }, baseCost: 0 },
  ])(
    "prices root mutations with $label complexity",
    async ({ options, baseCost }) => {
      const app = await createApp(
        GraphQLRateLimitModule.forRoot({ ...options, getId: () => "client" }),
      );
      apps.push(app);
      const http = request(app.getHttpServer());

      for (const [query, expectedCost] of [
        ["{ hello }", 0],
        ["mutation { updateStatus }", baseCost],
        ["mutation { updateRecord { status } }", baseCost],
        ["mutation { updateRecord { details { message } } }", baseCost + 2],
        ["mutation { updateWithExplicitCost }", 3],
      ] as const) {
        const response = await http
          .post("/graphql")
          .send({ query })
          .expect(200);
        const body = response.body as GraphQLResponse;
        expect(body.errors).toBeUndefined();
        expect(body.extensions?.cost).toMatchObject({
          requestedQueryCost: expectedCost,
          actualQueryCost: expectedCost,
        });
      }
    },
  );

  /**
   * Returns initialized test application and its exposed dependencies.
   * @param rateLimitModule - GraphQL rate-limit module registration to test.
   * @returns Initialized test application and its exposed dependencies.
   */
  async function createApp(
    rateLimitModule: DynamicModule,
  ): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot({
          autoSchemaFile: true,
          graphiql: false,
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
