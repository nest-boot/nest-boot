import {
  Args,
  Field,
  GraphQLModule,
  Int,
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
  errors?: { message: string; extensions?: { code?: string } }[];
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

@ObjectType()
class ReportSummary {
  static readonly complexity = 4;

  @Field(() => String, { complexity: 2 })
  title!: string;
}

@Resolver()
class TestResolver {
  @Query(() => String)
  hello(): string {
    return "world";
  }

  @Query(() => String, {
    complexity: ({ args, childComplexity, resolved }) => {
      const weight = (args.weight as number | undefined) ?? 0;
      return resolved
        ? Math.min(weight, resolved.result?.length ?? 0)
        : weight + childComplexity;
    },
  })
  weighted(@Args("weight", { type: () => Int }) weight: number): string {
    return String(weight);
  }

  @Query(() => ReportSummary)
  reportSummary(): ReportSummary {
    return { title: "Summary" };
  }

  @Query(() => [ReportSummary])
  reportSummaries(): ReportSummary[] {
    return [this.reportSummary()];
  }

  @Mutation(() => ReportSummary)
  refreshSummary(): ReportSummary {
    return this.reportSummary();
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

  @Mutation(() => Int, {
    complexity: ({ resolved }) => (resolved ? (resolved.result ?? 0) : 7),
  })
  updateWithResolvedCost(): number {
    return 3;
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

  it("passes field arguments and results to query and mutation cost callbacks", async () => {
    const app = await createApp(GraphQLRateLimitModule.forRoot({}));
    apps.push(app);

    const response = await request(app.getHttpServer())
      .post("/graphql")
      .send({
        query: "query ($weight: Int!) { weighted(weight: $weight) }",
        variables: { weight: 7 },
      })
      .expect(200);
    const body = response.body as GraphQLResponse;
    expect(body.errors).toBeUndefined();
    expect(body.extensions?.cost).toMatchObject({
      requestedQueryCost: 7,
      actualQueryCost: 1,
    });

    const mutation = await request(app.getHttpServer())
      .post("/graphql")
      .send({ query: "mutation { updateWithResolvedCost }" })
      .expect(200);
    const mutationBody = mutation.body as GraphQLResponse;
    expect(mutationBody.errors).toBeUndefined();
    expect(mutationBody.extensions?.cost).toMatchObject({
      requestedQueryCost: 7,
      actualQueryCost: 3,
    });
  });

  it("uses an object type's default for single query results", async () => {
    const app = await createApp(GraphQLRateLimitModule.forRoot({}));
    apps.push(app);
    const http = request(app.getHttpServer());

    for (const [query, cost] of [
      ["{ reportSummary { title } }", 6],
      ["{ reportSummaries { title } }", 3],
      ["mutation { refreshSummary { title } }", 12],
    ] as const) {
      const response = await http.post("/graphql").send({ query }).expect(200);
      const body = response.body as GraphQLResponse;
      expect(body.errors).toBeUndefined();
      expect(body.extensions?.cost).toMatchObject({
        requestedQueryCost: cost,
        actualQueryCost: cost,
      });
    }
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
      .expect(429);
    const body = response.body as GraphQLResponse;

    expect(body.data).toBeUndefined();
    expect(body.errors?.[0]).toMatchObject({
      message: "Query is too complex: 7. Maximum allowed complexity: 7",
      extensions: { code: "TOO_MANY_REQUESTS" },
    });
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

  it("returns HTTP 429 when the client has insufficient points", async () => {
    const app = await createApp(
      GraphQLRateLimitModule.forRoot({
        defaultComplexity: 15,
        maximumAvailable: 20,
        restoreRate: 1,
        getId: () => "client",
      }),
    );
    apps.push(app);
    const http = request(app.getHttpServer());

    await http.post("/graphql").send({ query: "{ hello }" }).expect(200);
    const response = await http
      .post("/graphql")
      .send({ query: "{ hello }" })
      .expect(429);
    const body = response.body as GraphQLResponse;

    expect(body.data).toBeUndefined();
    expect(body.errors?.[0]).toMatchObject({
      message: "Too Many Requests",
      extensions: { code: "TOO_MANY_REQUESTS" },
    });
  });

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
