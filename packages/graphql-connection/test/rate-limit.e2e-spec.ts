import { EntitySchema, MikroORM } from "@mikro-orm/core";
import { PgliteDriver } from "@mikro-orm/pglite";
import {
  Args,
  Field,
  GraphQLModule,
  ID,
  ObjectType,
  Query,
  ResolveField,
  Resolver,
} from "@nest-boot/graphql";
import {
  GraphQLRateLimitModule,
  MemoryGraphQLRateLimitDriver,
} from "@nest-boot/graphql-rate-limit";
import type { DynamicModule, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import {
  type ConnectionArgsInterface,
  ConnectionBuilder,
  ConnectionManager,
  type ConnectionResult,
  Count,
  type CountArgsInterface,
} from "../src/index.js";

@ObjectType()
class CostBook {
  @Field(() => ID, { complexity: 1 })
  id!: number;

  @Field(() => String)
  name!: string;
}

const BookSchema = new EntitySchema({
  class: CostBook,
  properties: {
    id: { type: "number", primary: true },
    name: { type: "string" },
  },
});
const { Connection, ConnectionArgs, CountArgs } = new ConnectionBuilder(
  CostBook,
)
  .addField({ field: "name", type: "string", filterable: true })
  .build();

@ObjectType()
class BookPage extends Connection {}

@ObjectType()
class BookOwner {
  @Field(() => Boolean)
  present!: boolean;
}

@Resolver(() => BookOwner)
class BookResolver {
  constructor(private readonly manager: ConnectionManager) {}

  @Query(() => String)
  status(): string {
    return "ok";
  }

  @Query(() => BookOwner, { nullable: true })
  owner(
    @Args("present", { type: () => Boolean }) present: boolean,
  ): BookOwner | null {
    return present ? { present } : null;
  }

  @Query(() => Connection)
  catalog(
    @Args({ type: () => ConnectionArgs })
    args: ConnectionArgsInterface<CostBook>,
  ): Promise<ConnectionResult<CostBook>> {
    return this.manager.find(Connection, args);
  }

  @Query(() => Connection, { complexity: 0 })
  freeCatalog(
    @Args({ type: () => ConnectionArgs })
    args: ConnectionArgsInterface<CostBook>,
  ): Promise<ConnectionResult<CostBook>> {
    return this.manager.find(Connection, args);
  }

  @Query(() => Count)
  catalogCount(
    @Args({ type: () => CountArgs }) args: CountArgsInterface<CostBook>,
  ): Promise<Count> {
    return this.manager.count(Connection, args);
  }

  @Query(() => Count, { complexity: 0 })
  freeCount(
    @Args({ type: () => CountArgs }) args: CountArgsInterface<CostBook>,
  ): Promise<Count> {
    return this.manager.count(Connection, args);
  }

  @ResolveField(() => Count)
  booksCount(
    @Args({ type: () => CountArgs }) args: CountArgsInterface<CostBook>,
  ): Promise<Count> {
    return this.manager.count(Connection, args);
  }

  @ResolveField(() => BookPage, { nullable: true })
  books(
    @Args({ type: () => ConnectionArgs })
    args: ConnectionArgsInterface<CostBook>,
  ): Promise<ConnectionResult<CostBook>> {
    return this.manager.find(Connection, args);
  }
}

describe("Connection complexity over GraphQL HTTP", () => {
  let orm: MikroORM<PgliteDriver>;
  let app: INestApplication | undefined;

  beforeAll(async () => {
    orm = await MikroORM.init({
      driver: PgliteDriver,
      entities: [BookSchema],
      dbName: "memory://",
    });
    await orm.schema.create();
    await orm.em.fork().insertMany(CostBook, [
      { id: 1, name: "alpha" },
      { id: 2, name: "alpha" },
      { id: 3, name: "beta" },
    ]);
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  afterAll(async () => {
    await orm?.close(true);
  });

  it("reserves the requested rows, refunds unused rows, and counts subfields once", async () => {
    const driver = new MemoryGraphQLRateLimitDriver();
    const update = vi.spyOn(driver, "update");
    const url = await startApp(
      GraphQLRateLimitModule.forRoot({
        driver,
        maxComplexity: 24,
      }),
    );

    const cases = [
      {
        selection: "books(first: 1) { items: edges { cursor } }",
        books: {
          items: [expect.objectContaining({ cursor: expect.any(String) })],
        },
        requested: 4,
        actual: 4,
      },
      {
        selection: "books(first: 20) { edges { cursor } }",
        books: {
          edges: Array.from({ length: 3 }, () => ({
            cursor: expect.any(String),
          })),
        },
        requested: 23,
        actual: 6,
      },
      {
        selection: "books(last: 2) { edges { node { id } } }",
        books: { edges: [{ node: { id: "2" } }, { node: { id: "3" } }] },
        requested: 9,
        actual: 9,
      },
      {
        selection: "books(first: 1) { pageInfo { hasNextPage } }",
        books: { pageInfo: { hasNextPage: true } },
        requested: 4,
        actual: 4,
      },
    ];

    for (const { selection, books, requested, actual } of cases) {
      update.mockClear();
      const response = await query(
        url,
        `{ owner(present: true) { ${selection} } }`,
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        data: { owner: { books } },
        extensions: {
          cost: { requestedQueryCost: requested, actualQueryCost: actual },
        },
      });
      expect(update.mock.calls.map(([input]) => input.points)).toEqual([
        requested,
        -(requested - actual),
      ]);
    }

    update.mockClear();
    const rejected = await query(
      url,
      "{ owner(present: true) { books(first: 21) { edges { cursor } } } }",
    );
    expect(rejected.status).toBe(429);
    expect(update).not.toHaveBeenCalled();
  });

  it("uses the default query field cost and honors an explicit zero cost", async () => {
    const url = await startApp(
      GraphQLRateLimitModule.forRoot({ maxComplexity: 24 }),
    );
    const response = await query(
      url,
      "{ catalog(first: 20) { edges { cursor } } freeCatalog(first: 30) { edges { cursor } } }",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        catalog: {
          edges: expect.arrayContaining([{ cursor: expect.any(String) }]),
        },
        freeCatalog: {
          edges: expect.arrayContaining([{ cursor: expect.any(String) }]),
        },
      },
      extensions: { cost: { requestedQueryCost: 22, actualQueryCost: 5 } },
    });
  });

  it("charges a standalone count for its filters once", async () => {
    const url = await startApp(GraphQLRateLimitModule.forRoot({}));
    const cases = [
      ["{ catalogCount { count } }", 10, { count: 3 }],
      ['{ catalogCount(query: "name:alpha") { count } }', 11, { count: 2 }],
      [
        '{ catalogCount(filter: { name: "beta" }) { count } }',
        11,
        { count: 1 },
      ],
      [
        '{ catalogCount(query: "name:alpha", filter: { name: "alpha" }) { count precision } }',
        13,
        { count: 2, precision: "EXACT" },
      ],
    ] as const;

    for (const [document, points, result] of cases) {
      const response = await query(url, document);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        data: { catalogCount: result },
        extensions: {
          cost: { requestedQueryCost: points, actualQueryCost: points },
        },
      });
    }
  });

  it("infers nested count costs and honors explicit complexity", async () => {
    const url = await startApp(GraphQLRateLimitModule.forRoot({}));
    const response = await query(
      url,
      '{ owner(present: true) { booksCount(query: "name:alpha") { count } } freeCount(query: "name:beta") { count } }',
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        owner: { booksCount: { count: 2 } },
        freeCount: { count: 1 },
      },
      extensions: { cost: { requestedQueryCost: 12, actualQueryCost: 12 } },
    });
  });

  it.each([false, true])(
    "keeps pagination errors on the executed field with rate limiting=%s",
    async (rateLimited) => {
      const url = await startApp(
        rateLimited ? GraphQLRateLimitModule.forRoot({}) : undefined,
      );

      for (const args of [
        "",
        "(first: -1)",
        "(first: 0)",
        "(last: 0)",
        "(first: 101)",
        "(last: 101)",
        "(first: 1, last: 1)",
        '(last: 1, after: "cursor")',
      ]) {
        const response = await query(
          url,
          `{
          status
          absent: owner(present: false) { books${args} { pageInfo { hasNextPage } } }
          present: owner(present: true) { books${args} { pageInfo { hasNextPage } } }
        }`,
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          data: { status: "ok", absent: null, present: { books: null } },
          errors: [
            {
              path: ["present", "books"],
              extensions: { code: "BAD_USER_INPUT" },
            },
          ],
        });
      }
    },
  );

  /**
   * Starts the test application with the seeded database.
   * @param rateLimit - Optional rate limiter registration.
   * @returns The GraphQL HTTP endpoint.
   */
  async function startApp(rateLimit?: DynamicModule): Promise<string> {
    const imports = [
      GraphQLModule.forRoot({ autoSchemaFile: true, graphiql: false }),
    ];
    if (rateLimit) {
      imports.push(rateLimit);
    }
    const moduleRef = await Test.createTestingModule({
      imports,
      providers: [
        BookResolver,
        {
          provide: ConnectionManager,
          useValue: new ConnectionManager(orm.em.fork()),
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, "127.0.0.1");
    return `${await app.getUrl()}/graphql`;
  }

  /**
   * Sends an operation to the GraphQL endpoint.
   * @param url - The GraphQL HTTP endpoint.
   * @param document - The GraphQL operation.
   * @returns The raw HTTP response.
   */
  function query(url: string, document: string): Promise<Response> {
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: document }),
    });
  }
});
