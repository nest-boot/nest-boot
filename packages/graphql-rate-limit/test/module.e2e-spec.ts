import {
  Args,
  Field,
  type FieldComplexityEstimatorArgs,
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

import { Complexity } from "../src/decorators/index.js";
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
  static readonly complexity = 5;

  @Field(() => String, { complexity: 2 })
  title!: string;
}

@ObjectType()
class WeightedSummary {
  @Field(() => String, { complexity: 2 })
  title!: string;

  static complexity({
    args,
    childComplexity,
    resolved,
  }: FieldComplexityEstimatorArgs<WeightedSummary>): number | undefined {
    if (args.weighted === true) {
      return resolved
        ? (resolved.result?.title.length ?? 0)
        : 5 + childComplexity;
    }
  }
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

  @Query(() => WeightedSummary)
  weightedSummary(
    @Args("weighted", { type: () => Boolean }) _weighted: boolean,
  ): WeightedSummary {
    return { title: "abc" };
  }

  @Mutation(() => ReportSummary)
  refreshSummary(): ReportSummary {
    return this.reportSummary();
  }

  @Mutation(() => ReportSummary, { mutationComplexity: 4 })
  refreshSummaryWithCustomBase(): ReportSummary {
    return this.reportSummary();
  }

  @Mutation(() => WeightedSummary)
  refreshWeightedSummary(
    @Args("weighted", { type: () => Boolean }) weighted: boolean,
  ): WeightedSummary {
    return this.weightedSummary(weighted);
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

  @Mutation(() => Boolean, { mutationComplexity: 0, complexity: 3 })
  updateWithZeroBase(): boolean {
    return true;
  }

  @Mutation(() => Boolean, { complexity: 9 })
  @Complexity({ value: 2, multipliers: ["weight"] })
  updateWithDirective(
    @Args("weight", { type: () => Int }) _weight: number,
  ): boolean {
    return true;
  }

  @Mutation(() => Int, {
    complexity: ({ resolved }) => {
      if (!resolved) {
        return 7;
      }
      return typeof resolved.result === "number" ? resolved.result : 0;
    },
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
      requestedQueryCost: 17,
      actualQueryCost: 13,
    });
  });

  it("uses numeric and callback defaults from field complexity metadata", async () => {
    const app = await createApp(GraphQLRateLimitModule.forRoot({}));
    apps.push(app);
    const http = request(app.getHttpServer());

    for (const [query, requested, actual = requested] of [
      ["{ reportSummary { title } }", 7],
      ["{ reportSummaries { title } }", 3],
      ["{ weightedSummary(weighted: true) { title } }", 7, 5],
      ["{ weightedSummary(weighted: false) { title } }", 3],
      ["mutation { refreshSummary { __typename } }", 15],
      ["mutation { refreshSummary { title } }", 17],
      ["mutation { refreshWeightedSummary(weighted: true) { title } }", 17, 15],
      ["mutation { refreshWeightedSummary(weighted: false) { title } }", 12],
      ["mutation { updateWithDirective(weight: 3) }", 16, 12],
    ] as const) {
      const response = await http.post("/graphql").send({ query }).expect(200);
      const body = response.body as GraphQLResponse;
      expect(body.errors).toBeUndefined();
      expect(body.extensions?.cost).toMatchObject({
        requestedQueryCost: requested,
        actualQueryCost: actual,
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

  it("adds the default or configured base cost once per root mutation field", async () => {
    const app = await createApp(
      GraphQLRateLimitModule.forRoot({ getId: () => "client" }),
    );
    apps.push(app);
    const http = request(app.getHttpServer());

    for (const [query, expectedCost] of [
      ["mutation { updateStatus }", 10],
      ["mutation { updateRecord { details { message } } }", 12],
      ["mutation { updateWithExplicitCost }", 13],
      ["mutation { updateWithZeroBase }", 3],
      ["mutation { refreshSummaryWithCustomBase { title } }", 11],
      ["mutation { updateStatus updateWithExplicitCost }", 23],
      [
        `mutation Merge($include: Boolean! = false) {
          updateWithExplicitCost
          ...Repeated
          skipped: updateWithExplicitCost @include(if: $include)
        }
        fragment Repeated on Mutation { updateWithExplicitCost }`,
        13,
      ],
      ["mutation { a: updateWithExplicitCost b: updateWithExplicitCost }", 26],
      [
        "mutation { refreshSummary { __typename } refreshSummary { title } }",
        17,
      ],
    ] as const) {
      const response = await http.post("/graphql").send({ query }).expect(200);
      const body = response.body as GraphQLResponse;
      expect(body.errors).toBeUndefined();
      expect(body.extensions?.cost).toMatchObject({
        requestedQueryCost: expectedCost,
        actualQueryCost: expectedCost,
      });
    }
  });

  it("charges a mutation base only at the operation root", async () => {
    const module = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot({
          autoSchemaFile: false,
          graphiql: false,
          typeDefs: /* GraphQL */ `
            type Query {
              mutationFields: Mutation!
            }

            type Mutation {
              update: Boolean!
            }
          `,
          resolvers: {
            Query: { mutationFields: () => ({ update: true }) },
            Mutation: { update: () => true },
          },
        }),
        GraphQLRateLimitModule.forRoot({}),
      ],
    }).compile();
    const app = module.createNestApplication({ logger: false });
    apps.push(app);
    await app.init();

    const http = request(app.getHttpServer());
    for (const [query, cost] of [
      ["{ mutationFields { update } }", 1],
      ["mutation { __typename update }", 10],
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
