import {
  Args,
  Field,
  type FieldComplexityEstimatorArgs,
  GraphQLModule,
  ID,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "@nest-boot/graphql";
import { type DynamicModule, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { Complexity } from "../../src/decorators/index.js";
import { GraphQLRateLimitModule } from "../../src/graphql-rate-limit.module.js";

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

@InputType()
class SkillOwnerInput {
  @Field(() => String)
  type!: string;
}

@InputType()
class CreateSkillInput {
  @Field(() => SkillOwnerInput)
  owner!: SkillOwnerInput;
}

@InputType()
class CreateDetailedSkillInput {
  @Field(() => SkillOwnerInput)
  owner!: SkillOwnerInput;

  @Field(() => String)
  name!: string;
}

const createSkillResolver = vi.fn(() => "skill-1");

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

  @Mutation(() => ID)
  createSkill(
    @Args("input", { type: () => CreateSkillInput }) _input: CreateSkillInput,
  ): string {
    return createSkillResolver();
  }

  @Mutation(() => ID)
  createDetailedSkill(
    @Args("input", { type: () => CreateDetailedSkillInput })
    _input: CreateDetailedSkillInput,
  ): string {
    return createSkillResolver();
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

  it.each([
    {
      selection: "an aliased root query field",
      query: "{ type: __typename }",
      cost: 0,
    },
    {
      selection: "root and nested query fields",
      query: "{ __typename hello reportSummaries { type: __typename title } }",
      cost: 10,
    },
    {
      selection: "root and nested mutation fields",
      query:
        "mutation { type: __typename refreshWeightedSummary(weighted: false) { __typename title } }",
      cost: 12,
    },
  ])(
    "excludes __typename from the cost of $selection with a nonzero default",
    async ({ query, cost }) => {
      const app = await createApp(
        GraphQLRateLimitModule.forRoot({
          maxComplexity: 13,
          defaultComplexity: 7,
        }),
      );
      apps.push(app);

      const response = await request(app.getHttpServer())
        .post("/graphql")
        .send({ query })
        .expect(200);
      const body = response.body as GraphQLResponse;
      expect(body.errors).toBeUndefined();
      expect(body.extensions?.cost).toMatchObject({
        requestedQueryCost: cost,
        actualQueryCost: cost,
      });
    },
  );

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
            maxComplexity: 6,
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
      message: "Query is too complex: 7. Maximum allowed complexity: 6",
      extensions: { code: "TOO_MANY_REQUESTS" },
    });
  });

  it("accepts the default maximum cost and rejects requests above it", async () => {
    const app = await createApp(GraphQLRateLimitModule.forRoot({}));
    apps.push(app);
    const http = request(app.getHttpServer());

    const allowed = await http
      .post("/graphql")
      .send({ query: "{ weighted(weight: 1000) }" })
      .expect(200);
    expect(allowed.body).toMatchObject({
      data: { weighted: "1000" },
      extensions: {
        cost: {
          requestedQueryCost: 1000,
          throttleStatus: { maximumAvailable: 2000, restoreRate: 100 },
        },
      },
    });

    const rejected = await http
      .post("/graphql")
      .send({ query: "{ weighted(weight: 1001) }" })
      .expect(429);
    expect((rejected.body as GraphQLResponse).errors?.[0]?.message).toBe(
      "Query is too complex: 1001. Maximum allowed complexity: 1000",
    );
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

  it("preserves Apollo responses for invalid variables and unresolved operations without calling resolvers or charging points", async () => {
    createSkillResolver.mockClear();
    const baselineApp = await createApp();
    const rateLimitedApp = await createApp(
      GraphQLRateLimitModule.forRoot({
        maxComplexity: 10,
        defaultComplexity: 10,
        maximumAvailable: 10,
        restoreRate: 1,
        getId: () => "client",
      }),
    );
    apps.push(baselineApp, rateLimitedApp);
    const baselineHttp = request(baselineApp.getHttpServer());
    const rateLimitedHttp = request(rateLimitedApp.getHttpServer());
    const createSkillMutation = /* GraphQL */ `
      mutation CreateSkill($input: CreateSkillInput!) {
        createSkill(input: $input)
      }
    `;
    const createDetailedSkillMutation = /* GraphQL */ `
      mutation CreateDetailedSkill($input: CreateDetailedSkillInput!) {
        createDetailedSkill(input: $input)
      }
    `;

    for (const payload of [
      { query: createSkillMutation, variables: { input: {} } },
      { query: createDetailedSkillMutation, variables: { input: {} } },
      { query: createSkillMutation, variables: {} },
      { query: createSkillMutation, variables: { input: null } },
      {
        query:
          "query ($first: Int!, $second: Int!) { a: weighted(weight: $first) b: weighted(weight: $second) }",
        variables: {},
      },
      {
        query:
          "mutation Update($include: Boolean!) { updateStatus @include(if: $include) }",
        variables: { include: null },
      },
      { query: "query First { hello } query Second { hello }" },
      { query: "query First { hello }", operationName: "Missing" },
    ]) {
      const [baseline, rateLimited] = await Promise.all([
        baselineHttp.post("/graphql").send(payload),
        rateLimitedHttp.post("/graphql").send(payload),
      ]);

      expect(rateLimited.status).toBe(400);
      expect(rateLimited.status).toBe(baseline.status);
      expect(rateLimited.body).toEqual(baseline.body);
    }

    const multiErrorResponse = await rateLimitedHttp
      .post("/graphql")
      .send({ query: createDetailedSkillMutation, variables: { input: {} } })
      .expect(400);
    expect((multiErrorResponse.body as GraphQLResponse).errors).toMatchObject([
      {
        message:
          'Variable "$input" got invalid value {}; Field "name" of required type "String!" was not provided.',
        extensions: { code: "BAD_USER_INPUT" },
      },
      {
        message:
          'Variable "$input" got invalid value {}; Field "owner" of required type "SkillOwnerInput!" was not provided.',
        extensions: { code: "BAD_USER_INPUT" },
      },
    ]);

    expect(createSkillResolver).not.toHaveBeenCalled();

    const validResponse = await rateLimitedHttp
      .post("/graphql")
      .send({ query: "{ hello }" })
      .expect(200);
    expect(validResponse.body).toMatchObject({
      data: { hello: "world" },
      extensions: {
        cost: {
          requestedQueryCost: 10,
          actualQueryCost: 10,
        },
      },
    });
  });

  /**
   * Returns initialized test application and its exposed dependencies.
   * @param rateLimitModule - Optional GraphQL rate-limit module registration to test.
   * @returns Initialized test application and its exposed dependencies.
   */
  async function createApp(
    rateLimitModule?: DynamicModule,
  ): Promise<INestApplication> {
    const imports: DynamicModule[] = [
      GraphQLModule.forRoot({
        autoSchemaFile: true,
        graphiql: false,
      }),
    ];
    if (rateLimitModule) {
      imports.push(rateLimitModule);
    }
    const moduleRef = await Test.createTestingModule({
      imports,
      providers: [TestResolver],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    return app;
  }
});
