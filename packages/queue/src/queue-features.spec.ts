import { EntityManager, EntitySchema, MikroORM } from "@mikro-orm/core";
import { PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import {
  GraphQLModule,
  GraphQLSchemaHost,
  Query,
  Resolver,
} from "@nest-boot/graphql";
import { getQueueToken } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Job as BullJob, Queue } from "bullmq";

import { Job } from "./entities/job.entity.js";
import { QueueModule } from "./queue.module.js";
import type { RegisterQueueOptionsFactory } from "./register-queue-options.interface.js";
import { JobService } from "./services/job.service.js";

// Exercise real Nest option factories while replacing only the Redis transport.
vi.mock("bullmq", async (importOriginal) => {
  const actual = await importOriginal<typeof import("bullmq")>();
  const { EventEmitter } = await import("node:events");
  class Queue extends EventEmitter {
    readonly qualifiedName: string;
    constructor(
      readonly name: string,
      readonly opts: { prefix?: string },
    ) {
      super();
      this.qualifiedName = `${opts.prefix ?? "bull"}:${name}`;
    }
    async close() {
      await Promise.resolve();
    }
  }
  return { ...actual, Queue };
});

class QueueOptionsFactory implements RegisterQueueOptionsFactory {
  createRegisterQueueOptions() {
    return { persist: true };
  }
}

@Module({ providers: [QueueOptionsFactory], exports: [QueueOptionsFactory] })
class QueueOptionsModule {}

@Resolver()
class PingResolver {
  @Query(() => String)
  ping() {
    return "pong";
  }
}

describe("QueueModule automatic job features", () => {
  it.each([
    { registration: "sync", persist: undefined },
    { registration: "sync", persist: false },
    { registration: "sync", persist: true },
    { registration: "async", persist: undefined },
    { registration: "async", persist: false },
    { registration: "async", persist: true },
    { registration: "useClass", persist: true },
    { registration: "useExisting", persist: true },
  ])(
    "$registration registers history only with persist=$persist",
    async ({ registration, persist }) => {
      const name = "email";
      const queueModule =
        registration === "sync"
          ? QueueModule.registerQueue({ name, persist })
          : QueueModule.registerQueueAsync({
              name,
              ...(registration === "useClass"
                ? { useClass: QueueOptionsFactory }
                : registration === "useExisting"
                  ? {
                      imports: [QueueOptionsModule],
                      useExisting: QueueOptionsFactory,
                    }
                  : {
                      inject: ["PERSIST"],
                      extraProviders: [
                        { provide: "PERSIST", useValue: persist },
                      ],
                      useFactory: async (enabled: boolean) => ({
                        persist: await Promise.resolve(enabled),
                      }),
                    }),
            });
      const module = await Test.createTestingModule({
        imports: [
          QueueModule,
          queueModule,
          DatabaseModule.forRoot({
            driver: PgliteDriver,
            dbName: "memory://",
            entities: [Job],
          }),
        ],
      }).compile();
      try {
        await module.init();
        const queue = module.get<Queue>(getQueueToken(name));
        const jobService = module.get(JobService);
        const write = vi.spyOn(jobService, "upsertJob").mockResolvedValue();
        queue.emit("waiting", { id: "42" } as BullJob);
        expect(write).toHaveBeenCalledTimes(persist ? 1 : 0);
        expect(queue.opts).not.toHaveProperty("persist");
      } finally {
        await module.close();
      }
    },
    30000,
  );

  it.each([false, true])(
    "rejects persist without database services (async=%s)",
    async (async) => {
      await expect(
        Test.createTestingModule({
          imports: [
            QueueModule,
            async
              ? QueueModule.registerQueueAsync({
                  name: "email",
                  useFactory: () => ({ persist: true }),
                })
              : QueueModule.registerQueue({ name: "email", persist: true }),
          ],
        }).compile(),
      ).rejects.toThrow(/Queue "email" has persist: true.*DatabaseModule/);
    },
  );

  it.each([
    { async: false, integrations: false },
    { async: true, integrations: false },
    { async: false, integrations: true },
    { async: true, integrations: true },
  ])(
    "keeps queues available when persistence is globally disabled (async=$async, integrations=$integrations)",
    async ({ async, integrations }) => {
      const options = { persistence: { enabled: false } };
      const module = await Test.createTestingModule({
        imports: [
          async
            ? QueueModule.forRootAsync({ useFactory: () => options })
            : QueueModule.forRoot(options),
          async
            ? QueueModule.registerQueueAsync({
                name: "email",
                useFactory: () => ({ persist: true }),
              })
            : QueueModule.registerQueue({ name: "email", persist: true }),
          ...(integrations
            ? [
                DatabaseModule.forRoot({
                  driver: PgliteDriver,
                  dbName: "memory://",
                  entities: [Job],
                }),
                GraphQLModule.forRoot({
                  autoSchemaFile: true,
                  graphiql: false,
                }),
              ]
            : []),
        ],
        providers: integrations ? [PingResolver] : [],
      }).compile();
      const app = module.createNestApplication();
      app.useLogger(false);
      try {
        await app.init();
        const queue = module.get<Queue>(getQueueToken("email"));
        expect(queue.name).toBe("email");
        expect(queue.listenerCount("waiting")).toBe(0);
        expect(queue.opts).not.toHaveProperty("persist");
        expect(queue.opts).not.toHaveProperty("persistence");
        expect(module.get(JobService)).toBeNull();
        if (integrations) {
          expect(
            Object.keys(
              module
                .get(GraphQLSchemaHost)
                .schema.getQueryType()
                ?.getFields() ?? {},
            ),
          ).toEqual(["ping"]);
        }
      } finally {
        await app.close();
      }
    },
    30000,
  );

  it("rejects persist when ORM metadata contains a different Job entity", async () => {
    const entities = [
      new EntitySchema({
        name: "Job",
        properties: { id: { type: "number", primary: true } },
      }),
    ];
    const orm = await MikroORM.init({
      driver: PgliteDriver,
      dbName: "memory://",
      entities,
    });
    try {
      await expect(
        Test.createTestingModule({
          imports: [
            QueueModule,
            DatabaseModule.forRoot({
              driver: PgliteDriver,
              dbName: "memory://",
              entities,
            }),
            QueueModule.registerQueue({ name: "email", persist: true }),
          ],
        })
          .overrideProvider(MikroORM)
          .useValue(orm)
          .compile(),
      ).rejects.toThrow(/include the built-in Job entity/);
    } finally {
      await orm.close();
    }
  }, 30000);

  it("does not activate installed integrations without application services", async () => {
    const module = await Test.createTestingModule({
      imports: [QueueModule.forRoot({})],
    }).compile();
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

  it.each([false, true])(
    "disables GraphQL without disabling history (async=%s)",
    async (async) => {
      const options = { graphql: false };
      const module = await Test.createTestingModule({
        imports: [
          async
            ? QueueModule.forRootAsync({ useFactory: () => options })
            : QueueModule.forRoot(options),
          DatabaseModule.forRoot({
            driver: PgliteDriver,
            dbName: "memory://",
            entities: [Job],
          }),
          GraphQLModule.forRoot({ autoSchemaFile: true, graphiql: false }),
        ],
        providers: [PingResolver],
      }).compile();
      const app = module.createNestApplication();
      app.useLogger(false);
      try {
        await app.init();
        expect(module.get(JobService)).toBeInstanceOf(JobService);
        expect(
          Object.keys(
            module.get(GraphQLSchemaHost).schema.getQueryType()?.getFields() ??
              {},
          ),
        ).toEqual(["ping"]);
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
      expect(module.get(JobService)).toBeNull();
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
