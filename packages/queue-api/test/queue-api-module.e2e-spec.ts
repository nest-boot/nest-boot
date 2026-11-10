import { EntityManager } from "@mikro-orm/core";
import { AuthGuard, WorkspaceService } from "@nest-boot/auth";
import { GraphQLModule, GraphQLSchemaHost } from "@nest-boot/graphql";
import { Test } from "@nestjs/testing";
import { isEnumType } from "graphql";
import request from "supertest";

import { JobProcessor } from "../dist/processors/job.processor.js";
import { QueueApiModule } from "../dist/queue-api.module.js";
import { JobResolver } from "../dist/resolvers/job.resolver.js";
import { JobService } from "../dist/services/job.service.js";
import { mockAuthService } from "./auth.fixture.js";

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

it.each([true, false])(
  "registers the module with workspace enabled: %s",
  async (workspaceEnabled) => {
    const module = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot({ autoSchemaFile: true, graphiql: false }),
        QueueApiModule,
      ],
      providers: workspaceEnabled
        ? []
        : [{ provide: WorkspaceService, useValue: null }],
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
      if (!workspaceEnabled) {
        expect(module.get(WorkspaceService)).toBeNull();
        const response = await request(app.getHttpServer())
          .post("/api/graphql")
          .send({
            query:
              '{ workspaceJob(id: "ignored") { id } workspaceJobs(first: 1) { totalCount } }',
          });
        expect(response.status).toBe(200);
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              extensions: expect.objectContaining({ code: "FORBIDDEN" }),
            }),
          ]),
        );
        expect(
          response.body.errors.every(
            (error: { message: string }) =>
              error.message === "An authorized current workspace is required.",
          ),
        ).toBe(true);
      }
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
  },
);

it("requires the application's global EntityManager", async () => {
  await expect(
    Test.createTestingModule({ imports: [QueueApiModule] }).compile(),
  ).rejects.toThrow("EntityManager");
});
