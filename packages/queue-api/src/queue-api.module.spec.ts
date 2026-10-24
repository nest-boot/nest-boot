import { EntityManager } from "@mikro-orm/core";
import { AuthGuard } from "@nest-boot/auth";
import { GraphQLModule, GraphQLSchemaHost } from "@nest-boot/graphql";
import { Test } from "@nestjs/testing";
import { isEnumType } from "graphql";

import { mockAuthService } from "../test/auth.fixture.js";
import { JobProcessor } from "./processors/job.processor.js";
import { QueueApiModule } from "./queue-api.module.js";
import { JobResolver } from "./resolvers/job.resolver.js";
import { JobService } from "./services/job.service.js";

vi.mock("bullmq", async (original) => {
  const actual = await original<typeof import("bullmq")>();
  const { EventEmitter } = await import("node:events");
  return {
    ...actual,
    QueueEvents: class extends EventEmitter {
      close = vi.fn().mockResolvedValue(undefined);
      run = vi.fn().mockResolvedValue(undefined);
      waitUntilReady = vi.fn().mockResolvedValue(undefined);
    },
    Queue: class extends EventEmitter {
      close = vi.fn().mockResolvedValue(undefined);
      upsertJobScheduler = vi.fn().mockResolvedValue(undefined);
      constructor(
        readonly name: string,
        readonly opts: object,
      ) {
        super();
      }
    },
  };
});

it("registers services, the built-in processor and the GraphQL schema", async () => {
  const module = await Test.createTestingModule({
    imports: [
      GraphQLModule.forRoot({ autoSchemaFile: true, graphiql: false }),
      QueueApiModule,
    ],
  })
    .overrideGuard(AuthGuard)
    .useValue({ canActivate: () => true })
    .useMocker((token) =>
      token === EntityManager ? {} : mockAuthService(token),
    )
    .compile();
  const app = module.createNestApplication();
  app.useLogger(false);
  try {
    await app.init();
    expect(module.get(JobService)).toBeInstanceOf(JobService);
    expect(module.get(JobResolver)).toBeInstanceOf(JobResolver);
    expect(module.get(JobProcessor)).toBeInstanceOf(JobProcessor);
    const schema = module.get(GraphQLSchemaHost).schema;
    expect(Object.keys(schema.getQueryType()?.getFields() ?? {})).toEqual(
      expect.arrayContaining([
        "userJob",
        "userJobs",
        "workspaceJob",
        "workspaceJobs",
        "systemJob",
        "systemJobs",
      ]),
    );
    expect(schema.getQueryType()?.getFields()).not.toHaveProperty("job");
    expect(schema.getQueryType()?.getFields()).not.toHaveProperty("jobs");
    expect(schema.getType("Job")).toBeDefined();
    const orderField = schema.getType("JobOrderField");
    expect(
      orderField && isEnumType(orderField)
        ? orderField.getValues().map(({ name }) => name)
        : [],
    ).toEqual(["CREATED_AT"]);
  } finally {
    await app.close();
  }
});

it("requires the application's global EntityManager", async () => {
  await expect(
    Test.createTestingModule({ imports: [QueueApiModule] }).compile(),
  ).rejects.toThrow("EntityManager");
});
