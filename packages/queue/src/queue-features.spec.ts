import { EntityManager, EntitySchema, MikroORM } from "@mikro-orm/core";
import { PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import {
  GraphQLModule,
  GraphQLSchemaHost,
  Query,
  Resolver,
} from "@nest-boot/graphql";
import { DiscoveryService } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { Job as BullJob, Queue } from "bullmq";

import { Job } from "./entities/job.entity.js";
import { JobStatus } from "./enums/job-status.enum.js";
import {
  BaseQueue,
  Queue as DeclareQueue,
  type QueueDefinition,
  QueueFactory,
} from "./index.js";
import { QueueModule } from "./queue.module.js";
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

/**
 * Defines a test queue provider.
 * @param options - Queue declaration.
 * @param async - Whether to use a factory provider.
 * @returns Queue provider for a testing module.
 */
function queueProvider(options: QueueDefinition, async = false) {
  @DeclareQueue(options)
  class TestQueue extends BaseQueue {}
  return async
    ? {
        provide: TestQueue,
        inject: [QueueFactory],
        useFactory: async (factory: QueueFactory) =>
          await Promise.resolve(factory.create(TestQueue)),
      }
    : TestQueue;
}

@Resolver()
class PingResolver {
  @Query(() => String)
  ping() {
    return "pong";
  }
}

describe("QueueModule automatic job features", () => {
  it.each([false, true])(
    "preserves worker results across separate producer writes (worker first=%s)",
    async (workerFirst) => {
      const module = await Test.createTestingModule({
        imports: [
          QueueModule,
          DatabaseModule.forRoot({
            driver: PgliteDriver,
            dbName: "memory://",
            entities: [Job],
          }),
        ],
      }).compile();
      try {
        const orm = module.get(MikroORM);
        await orm.schema.create();
        const producer = module.get(JobService);
        const consumer = new JobService(
          { getProviders: () => [] } as unknown as DiscoveryService,
          orm.em,
          {},
        );
        const waiting = {
          id: "42",
          queueName: "email",
          name: "send-email",
          data: { tenant: "allowed" },
          priority: 0,
          progress: 0,
          timestamp: Date.now(),
          getState: () => Promise.resolve("waiting"),
        } as unknown as BullJob;
        const completed = {
          ...waiting,
          progress: 100,
          returnvalue: { sent: true },
          processedOn: Date.now(),
          finishedOn: Date.now(),
          getState: () => Promise.resolve("completed"),
        } as unknown as BullJob;
        if (!workerFirst) await producer.upsertJob(waiting, "waiting");
        await consumer.upsertJob(completed, "completed");
        // A delayed or repeated producer event must never erase worker fields.
        await producer.upsertJob(waiting, "waiting");
        await producer.upsertJob(waiting, "waiting");
        const em = orm.em.fork();
        expect(await em.count(Job, {})).toBe(1);
        expect(await em.findOneOrFail(Job, "email:42")).toMatchObject({
          status: JobStatus.COMPLETED,
          progress: 100,
          returnValue: { sent: true },
          startedAt: new Date(completed.processedOn ?? 0),
          finishedAt: new Date(completed.finishedOn ?? 0),
        });
      } finally {
        await module.close();
      }
    },
    30000,
  );

  it.each([
    { registration: "sync", persistence: undefined },
    { registration: "sync", persistence: { enabled: false } },
    { registration: "sync", persistence: { enabled: true } },
    { registration: "async", persistence: undefined },
    { registration: "async", persistence: { enabled: false } },
    { registration: "async", persistence: { enabled: true } },
  ])(
    "$registration registers history only with persistence=$persistence",
    async ({ registration, persistence }) => {
      const name = "email";
      const provider = queueProvider(
        { name, persistence },
        registration === "async",
      );
      const module = await Test.createTestingModule({
        imports: [
          QueueModule,
          DatabaseModule.forRoot({
            driver: PgliteDriver,
            dbName: "memory://",
            entities: [Job],
          }),
        ],
        providers: [provider],
      }).compile();
      try {
        await module.init();
        const queue = module.get<Queue>(
          typeof provider === "function" ? provider : provider.provide,
        );
        const jobService = module.get(JobService);
        const write = vi.spyOn(jobService, "upsertJob").mockResolvedValue();
        queue.emit("waiting", { id: "42" } as BullJob);
        expect(write).toHaveBeenCalledTimes(persistence?.enabled ? 1 : 0);
        expect(queue.opts).not.toHaveProperty("persistence");
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
          imports: [QueueModule],
          providers: [
            queueProvider(
              { name: "email", persistence: { enabled: true } },
              async,
            ),
          ],
        }).compile(),
      ).rejects.toThrow(
        /Queue "email" has persistence.enabled: true.*DatabaseModule/,
      );
    },
  );

  it.each([false, true])(
    "starts disabled queues without database services (async=%s)",
    async (async) => {
      const queues = [
        { name: "disabled", persistence: { enabled: false, ttl: 0 } },
        { name: "ttl-only", persistence: { ttl: 0 } },
      ];
      const providers = queues.map((options) => queueProvider(options, async));
      const module = await Test.createTestingModule({
        imports: [QueueModule.forRoot({ persistence: { ttl: 1000 } })],
        providers,
      }).compile();
      try {
        await module.init();
        for (const provider of providers) {
          const queue = module.get<Queue>(
            typeof provider === "function" ? provider : provider.provide,
          );
          const name = queue.name;
          expect(queue.name).toBe(name);
          expect(queue.listenerCount("waiting")).toBe(0);
          expect(queue.opts).not.toHaveProperty("persistence");
        }
      } finally {
        await module.close();
      }
    },
  );

  it.each([
    { async: false, ttl: undefined },
    { async: false, ttl: 7 * 86400000 },
    { async: true, ttl: 7 * 86400000 },
  ])(
    "applies queue TTL overrides without deleting other queues (async=$async, global ttl=$ttl)",
    async ({ async, ttl }) => {
      const queues = [
        { name: "inherited", persistence: { enabled: true } },
        { name: "short", persistence: { enabled: true, ttl: 86400000 } },
        { name: "long", persistence: { enabled: true, ttl: 30 * 86400000 } },
        { name: "disabled", persistence: { enabled: false, ttl: 0 } },
        { name: "ttl-only", persistence: { ttl: 0 } },
      ];
      const options = { persistence: { ttl } };
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
        ],
        providers: queues.map((options) => queueProvider(options, async)),
      }).compile();
      try {
        const orm = module.get(MikroORM);
        await orm.schema.create();
        const em = orm.em.fork();
        const records = [
          { queueName: "inherited", age: 2, keep: true },
          { queueName: "inherited", age: 8, keep: ttl === undefined },
          { queueName: "inherited", age: 31, keep: false },
          { queueName: "short", age: 2, keep: false },
          { queueName: "long", age: 8, keep: true },
          { queueName: "long", age: 31, keep: false },
          { queueName: "disabled", age: 40, keep: true },
          { queueName: "ttl-only", age: 40, keep: true },
          { queueName: "elsewhere", age: 40, keep: true },
        ];
        await em.insertMany(
          Job,
          records.map(({ queueName, age }) => ({
            id: `${queueName}:${String(age)}`,
            queueName,
            name: "report",
            data: {},
            priority: 0,
            progress: 100,
            status: JobStatus.COMPLETED,
            updatedAt: new Date(Date.now() - age * 86400000),
          })),
        );
        await module.get(JobService).cleanJobs();
        expect(
          (await em.find(Job, {}, { orderBy: { id: "asc" } })).map(
            ({ id }) => id,
          ),
        ).toEqual(
          records
            .filter(({ keep }) => keep)
            .map(({ queueName, age }) => `${queueName}:${String(age)}`)
            .sort(),
        );
      } finally {
        await module.close();
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
          ],
          providers: [
            queueProvider({ name: "email", persistence: { enabled: true } }),
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
