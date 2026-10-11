import { EntityManager, EntitySchema } from "@mikro-orm/core";
import { PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import {
  GraphQLModule,
  GraphQLSchemaHost,
  Query,
  Resolver,
} from "@nest-boot/graphql";
import { Test } from "@nestjs/testing";

import { Job } from "./entities/job.entity.js";
import { QueueModule } from "./queue.module.js";
import { JobService } from "./services/job.service.js";
import { JobHistoryService } from "./services/job-history.service.js";

@Resolver()
class PingResolver {
  @Query(() => String)
  ping() {
    return "pong";
  }
}

describe("QueueModule automatic job features", () => {
  it("does not activate installed integrations without application services", async () => {
    const module = await Test.createTestingModule({
      imports: [QueueModule.forRoot({})],
    }).compile();
    expect(module.get(JobHistoryService)).toBeNull();
    expect(module.get(JobService)).toBeNull();
    await module.close();
  });

  it.each([false, true])(
    "discovers database services with GraphQL=%s",
    async (graphql) => {
      const module = await Test.createTestingModule({
        imports: [
          QueueModule.forRootAsync({ useFactory: () => ({}) }),
          DatabaseModule.forRoot({
            driver: PgliteDriver,
            dbName: "memory://",
            entities: [Job],
          }),
          ...(graphql
            ? [GraphQLModule.forRoot({ autoSchemaFile: true, graphiql: false })]
            : []),
        ],
        providers: graphql ? [PingResolver] : [],
      }).compile();
      const app = module.createNestApplication();
      app.useLogger(false);
      try {
        expect(module.get(EntityManager)).toBeDefined();
        expect(module.get(JobHistoryService)).toBeInstanceOf(JobHistoryService);
        expect(module.get(JobService)).toBeInstanceOf(JobService);
        if (graphql) {
          await app.init();
          const fields =
            module.get(GraphQLSchemaHost).schema.getQueryType()?.getFields() ??
            {};
          expect(Object.keys(fields)).toEqual(
            expect.arrayContaining(["job", "jobs", "ping"]),
          );
        }
      } finally {
        await app.close();
      }
    },
    30000,
  );

  it("keeps an existing database application without Job discovery as a plain queue", async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [
            new EntitySchema({
              name: "Job",
              properties: { id: { type: "number", primary: true } },
            }),
          ],
        }),
        GraphQLModule.forRoot({ autoSchemaFile: true, graphiql: false }),
        QueueModule,
      ],
      providers: [PingResolver],
    }).compile();
    const app = module.createNestApplication();
    app.useLogger(false);
    try {
      await app.init();
      expect(module.get(JobHistoryService)).toBeNull();
      expect(
        Object.keys(
          module.get(GraphQLSchemaHost).schema.getQueryType()?.getFields() ??
            {},
        ),
      ).toEqual(["ping"]);
    } finally {
      await app.close();
    }
  }, 30000);

  it("omits job queries when only GraphQL is registered", async () => {
    const module = await Test.createTestingModule({
      imports: [
        QueueModule.forRoot({}),
        GraphQLModule.forRoot({ autoSchemaFile: true, graphiql: false }),
      ],
      providers: [PingResolver],
    }).compile();
    const app = module.createNestApplication();
    app.useLogger(false);
    try {
      await app.init();
      expect(
        Object.keys(
          module.get(GraphQLSchemaHost).schema.getQueryType()?.getFields() ??
            {},
        ),
      ).toEqual(["ping"]);
    } finally {
      await app.close();
    }
  });
});
