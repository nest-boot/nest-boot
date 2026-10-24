import { EntityManager } from "@mikro-orm/core";
import { MikroORM } from "@mikro-orm/postgresql";
import {
  API_KEY,
  AuthGuard,
  type AuthModuleOptions,
  Member,
  MemberStatus,
  Session,
  User,
  UserApiKey,
  UserService,
  Workspace,
  WorkspaceService,
} from "@nest-boot/auth";
import { GraphQLModule } from "@nest-boot/graphql";
import { BaseQueue, Queue, type QueueManager } from "@nest-boot/queue";
import { RequestContext } from "@nest-boot/request-context";
import type { INestApplication } from "@nestjs/common";
import { ModuleRef, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";

import {
  JobEntity,
  JobResolver,
  JobService,
  JobStatus,
  QueueVisible,
} from "../dist/index.js";
import { createPostgresFixture } from "./postgres.fixture.js";

const id = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const nodeIds = (edges: { node: { id: string } }[]) =>
  edges.map(({ node }) => node.id);
const fieldNames = (fields: { name: string }[]) =>
  fields.map(({ name }) => name);

const authOptions: AuthModuleOptions = {
  user: { adminRoles: ["operator"], roles: { operator: [] } },
};

@QueueVisible()
@Queue("reports")
class ReportsQueue extends BaseQueue {}

@QueueVisible()
@Queue("exports")
class ExportsQueue extends BaseQueue {}

@QueueVisible()
@Queue("schedule")
class ScheduleQueue extends BaseQueue {}

@QueueVisible()
@Queue("maintenance")
class MaintenanceQueue extends BaseQueue {}

@Queue("hidden")
class HiddenQueue extends BaseQueue {}

const registeredQueues = [
  [ReportsQueue, "reports"],
  [ExportsQueue, "exports"],
  [ScheduleQueue, "schedule"],
  [MaintenanceQueue, "maintenance"],
  [HiddenQueue, "hidden"],
] as const;

describe("scoped Job GraphQL API", () => {
  let app: INestApplication;
  let orm: MikroORM;
  let database: Awaited<ReturnType<typeof createPostgresFixture>>;
  let jobs: JobService;
  const manager = { getQueues: vi.fn<() => readonly BaseQueue[]>() };

  beforeAll(async () => {
    database = await createPostgresFixture("public");
    orm = await MikroORM.init({
      clientUrl: database.connection.connectionString,
      schema: database.connection.schema,
      entities: [JobEntity],
      context: () =>
        RequestContext.isActive()
          ? RequestContext.get(EntityManager)
          : undefined,
    });
    await orm.schema.create();
    const fixtures = [
      { data: { userId: "101", workspaceId: "202" }, day: 1, queue: "reports" },
      { data: { userId: "102", workspaceId: "201" }, day: 2, queue: "exports" },
      { data: { userId: "101", workspaceId: "201" }, day: 2, queue: "reports" },
      { data: { userId: "102", workspaceId: "202" }, day: 4, queue: "reports" },
      {
        data: { userId: "101", workspaceId: "201" },
        day: 5,
        queue: "schedule",
      },
      { data: { userId: "101" }, day: 2, queue: "reports" },
      { data: { workspaceId: "201" }, day: 6, queue: "reports" },
      { data: {}, day: 8, queue: "maintenance" },
      {
        data: { userId: null, workspaceId: null },
        day: 8,
        queue: "maintenance",
      },
      { data: { userId: "", workspaceId: "" }, day: 10, queue: "maintenance" },
      { data: { userId: "101", workspaceId: "201" }, day: 11, queue: "hidden" },
      { data: {}, day: 12, queue: "hidden" },
      {
        data: { userId: "101", workspaceId: "201" },
        day: 13,
        queue: "unregistered",
      },
    ];
    for (const [index, fixture] of fixtures.entries()) {
      await orm.em.execute(
        "insert into job (id, queue, job_id, name, status, data, progress, return_value, failed_reason, created_at) values (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?)",
        [
          id(index + 1),
          fixture.queue,
          String(index + 1),
          "generate-report",
          JobStatus.COMPLETED,
          JSON.stringify(fixture.data),
          JSON.stringify(index === 0 ? { secret: "progress" } : 20),
          JSON.stringify({ secret: "result" }),
          "private error",
          new Date(Date.UTC(2026, 0, fixture.day)),
        ],
      );
    }
    const users = new UserService(
      orm.em,
      authOptions,
      {} as ConstructorParameters<typeof UserService>[2],
      { deleteUser: () => Promise.resolve(null) },
    );
    const workspaces = new WorkspaceService(orm.em, authOptions);
    manager.getQueues.mockReturnValue(
      registeredQueues.map(([target, name]) =>
        Object.assign(Object.create(target.prototype) as BaseQueue, { name }),
      ),
    );
    jobs = new JobService(
      orm.em,
      { on: vi.fn() } as unknown as ConstructorParameters<typeof JobService>[1],
      manager as unknown as QueueManager,
      users,
      workspaces,
    );
    vi.spyOn(jobs, "onModuleInit").mockResolvedValue(undefined);
    vi.spyOn(jobs, "onModuleDestroy").mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot({ autoSchemaFile: true, graphiql: false }),
      ],
      providers: [JobResolver, { provide: JobService, useValue: jobs }],
    })
      .overrideGuard(AuthGuard)
      .useFactory({
        factory: (reflector: Reflector, moduleRef: ModuleRef) =>
          new AuthGuard(reflector, authOptions, moduleRef),
        inject: [Reflector, ModuleRef],
      })
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const context = new RequestContext({ type: "http" });
      context.set(EntityManager, orm.em.fork());
      if (req.header("x-test-authenticated") === "true") {
        context.set(Session, new Session());
        const userId = req.header("x-test-user") ?? "101";
        const workspaceId = req.header("x-test-workspace") ?? "201";
        const user = Object.assign(new User(), {
          id: userId,
          roles: [req.header("x-test-role") ?? "user"],
        });
        if (userId) {
          context.set(User, user);
        }
        if (workspaceId) {
          const workspace = Object.assign(new Workspace(), { id: workspaceId });
          context.set(Workspace, workspace);
          if (req.header("x-test-member") !== "false") {
            context.set(
              Member,
              Object.assign(new Member(), {
                id: "301",
                user,
                workspace,
                status:
                  req.header("x-test-member-status") ?? MemberStatus.ACTIVE,
              }),
            );
          }
        }
        if (req.header("x-test-api-key") === "true") {
          context.set(
            API_KEY,
            Object.assign(new UserApiKey(), {
              id: "401",
              user,
              permissions: [],
            }),
          );
        }
      }
      void RequestContext.run(context, () => {
        next();
      });
    });
    await app.listen(0, "127.0.0.1");
  }, 30000);

  afterAll(async () => {
    await app?.close();
    await orm?.close();
    await database?.close();
  });

  /**
   * Executes an HTTP query through the real AuthGuard and request EntityManager.
   * @param source - GraphQL query.
   * @param variables - GraphQL variables.
   * @param authenticated - Whether a session identity is present.
   * @returns Pending HTTP request, optionally extended with identity headers.
   */
  function query(
    source: string,
    variables: Record<string, unknown> = {},
    authenticated = true,
  ) {
    return request(app.getHttpServer())
      .post("/api/graphql")
      .set("x-test-authenticated", String(authenticated))
      .send({ query: source, variables });
  }

  it("does not expose unscoped job/jobs or administrator-wide queries", async () => {
    const { body } = await query(
      "{ __schema { queryType { fields { name } } } }",
    );
    const fields = fieldNames(body.data.__schema.queryType.fields);
    expect(fields).toEqual(
      expect.arrayContaining([
        "userJob",
        "userJobs",
        "workspaceJob",
        "workspaceJobs",
        "systemJob",
        "systemJobs",
      ]),
    );
    for (const field of ["job", "jobs", "adminJob", "adminJobs"]) {
      expect(fields).not.toContain(field);
    }
  });

  it("keeps history free of database RLS policies", async () => {
    expect(
      await orm.em.execute(
        "select relrowsecurity from pg_class where oid = 'job'::regclass",
      ),
    ).toEqual([{ relrowsecurity: false }]);
    expect(
      await orm.em.execute(
        "select policyname from pg_policies where tablename = 'job'",
      ),
    ).toEqual([]);
  });

  it.each([
    { field: "userJob", visible: [1, 3, 5, 6] },
    { field: "workspaceJob", visible: [2, 3, 5, 7] },
    { field: "systemJob", visible: [8, 9] },
  ])("scopes every ID lookup through $field", async ({ field, visible }) => {
    for (let value = 1; value <= 10; value++) {
      const { body } = await query(
        `query($id: ID!) { ${field}(id: $id) { id queue progress } }`,
        { id: id(value) },
      ).set("x-test-role", "operator");
      expect(body.errors).toBeUndefined();
      if (visible.includes(value)) {
        expect(body.data[field].id).toBe(id(value));
      } else {
        expect(body.data[field]).toBeNull();
      }
    }
  });

  it.each(["userJob", "workspaceJob", "systemJob"])(
    "returns null for invalid IDs in %s after authorization",
    async (field) => {
      const { body } = await query(`{ ${field}(id: "invalid") { id } }`).set(
        "x-test-role",
        "operator",
      );
      expect(body.errors).toBeUndefined();
      expect(body.data[field]).toBeNull();
    },
  );

  it.each([
    { field: "userJob", value: 11 },
    { field: "workspaceJob", value: 11 },
    { field: "systemJob", value: 12 },
    { field: "userJob", value: 13 },
    { field: "workspaceJob", value: 13 },
  ])(
    "hides unmarked and unregistered queues in $field ($value)",
    async ({ field, value }) => {
      const { body } = await query(`{${field}(id:"${id(value)}"){id}}`).set(
        "x-test-role",
        "operator",
      );
      expect(body.errors).toBeUndefined();
      expect(body.data[field]).toBeNull();
    },
  );

  it.each(["userJobs", "workspaceJobs", "systemJobs"])(
    "excludes hidden queues from %s nodes and counts even with explicit filters",
    async (field) => {
      const { body } = await query(
        `query($filter:JobFilter){
          ${field}(first:10,filter:$filter) {
            totalCount edges{node{id}} pageInfo{hasNextPage hasPreviousPage}
          }
        }`,
        { filter: { $or: [{ queue: "hidden" }, { queue: "unregistered" }] } },
      ).set("x-test-role", "operator");
      expect(body.errors).toBeUndefined();
      expect(body.data[field]).toEqual({
        totalCount: 0,
        edges: [],
        pageInfo: { hasNextPage: false, hasPreviousPage: false },
      });
    },
  );

  it("returns empty scoped results when no visible queues are registered", async () => {
    const queues = manager.getQueues();
    manager.getQueues.mockReturnValue([]);
    try {
      const { body } = await query(`{
        userJob(id:"${id(1)}"){id}
        workspaceJob(id:"${id(2)}"){id}
        systemJob(id:"${id(8)}"){id}
        userJobs(first:10){totalCount edges{node{id}}}
        workspaceJobs(first:10){totalCount edges{node{id}}}
        systemJobs(first:10){totalCount edges{node{id}}}
      }`).set("x-test-role", "operator");
      expect(body.errors).toBeUndefined();
      for (const field of ["userJob", "workspaceJob", "systemJob"]) {
        expect(body.data[field]).toBeNull();
      }
      for (const field of ["userJobs", "workspaceJobs", "systemJobs"]) {
        expect(body.data[field]).toEqual({ totalCount: 0, edges: [] });
      }
    } finally {
      manager.getQueues.mockReturnValue(queues);
    }
  });

  it.each([
    "userJob",
    "workspaceJob",
    "systemJob",
    "userJobs",
    "workspaceJobs",
    "systemJobs",
  ])("requires authentication for %s", async (field) => {
    const args = field.endsWith("Jobs") ? "first: 10" : `id: "${id(8)}"`;
    const selection = field.endsWith("Jobs") ? "totalCount" : "id";
    const { body } = await query(
      `{ ${field}(${args}) { ${selection} } }`,
      {},
      false,
    );
    expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED");
  });

  it.each(["user", "admin"])(
    "denies system queries to a role not configured as administrator: %s",
    async (role) => {
      for (const source of [
        `{systemJob(id: "${id(8)}") {id}}`,
        "{systemJobs(first: 10) {totalCount}}",
      ]) {
        const { body } = await query(source).set("x-test-role", role);
        expect(body.errors[0].extensions.code).toBe("FORBIDDEN");
      }
    },
  );

  it("does not give an API key its owner's administrator access", async () => {
    const { body } = await query("{systemJobs(first: 10) {totalCount}}")
      .set("x-test-role", "operator")
      .set("x-test-api-key", "true");
    expect(body.errors[0].extensions.code).toBe("FORBIDDEN");
  });

  it.each([
    { header: "x-test-workspace", value: "" },
    { header: "x-test-member", value: "false" },
    { header: "x-test-member-status", value: MemberStatus.DISABLED },
  ])(
    "denies workspace reads for invalid membership: $header=$value",
    async ({ header, value }) => {
      const { body } = await query(
        "{workspaceJobs(first: 10) {totalCount}}",
      ).set(header, value);
      expect(body.errors[0].extensions.code).toBe("FORBIDDEN");
    },
  );

  it("denies user reads without a user identity", async () => {
    const { body } = await query("{userJobs(first: 10) {totalCount}}")
      .set("x-test-user", "")
      .set("x-test-workspace", "");
    expect(body.errors[0].extensions.code).toBe("FORBIDDEN");
  });

  it("keeps all three scopes isolated within one concurrent GraphQL operation", async () => {
    const { body } = await query(`{
      userJobs(first: 20) {totalCount edges {node {id}}}
      workspaceJobs(first: 20) {totalCount edges {node {id}}}
      systemJobs(first: 20) {totalCount edges {node {id}}}
    }`).set("x-test-role", "operator");
    expect(body.errors).toBeUndefined();
    expect(body.data.userJobs.totalCount).toBe(4);
    expect(body.data.workspaceJobs.totalCount).toBe(4);
    expect(body.data.systemJobs.totalCount).toBe(2);
    expect(nodeIds(body.data.userJobs.edges)).toEqual([5, 6, 3, 1].map(id));
    expect(nodeIds(body.data.workspaceJobs.edges)).toEqual(
      [7, 5, 3, 2].map(id),
    );
    expect(nodeIds(body.data.systemJobs.edges)).toEqual([9, 8].map(id));
  });

  it("keeps scoped ID lookups isolated even when another field loads the same entity", async () => {
    const { body } = await query(`{
      workspaceJob(id: "${id(2)}") {id}
      userJob(id: "${id(2)}") {id}
      systemJob(id: "${id(2)}") {id}
    }`).set("x-test-role", "operator");
    expect(body.errors).toBeUndefined();
    expect(body.data.workspaceJob.id).toBe(id(2));
    expect(body.data.userJob).toBeNull();
    expect(body.data.systemJob).toBeNull();
  });

  it("rejects direct scoped service calls without authentication context", async () => {
    for (const read of [
      () => jobs.getUserJob(id(1)),
      () => jobs.getWorkspaceJob(id(1)),
      () => jobs.getSystemJob(id(8)),
      () => jobs.getUserJobConnection({ first: 10 }),
      () => jobs.getWorkspaceJobConnection({ first: 10 }),
      () => jobs.getSystemJobConnection({ first: 10 }),
    ]) {
      await expect(read()).rejects.toMatchObject({ status: 403 });
    }
  });

  it.each([
    { field: "userJobs", direction: "ASC", ids: [1, 3, 6, 5] },
    { field: "userJobs", direction: "DESC", ids: [5, 6, 3, 1] },
    { field: "workspaceJobs", direction: "ASC", ids: [2, 3, 5, 7] },
    { field: "workspaceJobs", direction: "DESC", ids: [7, 5, 3, 2] },
  ])(
    "paginates $field $direction with stable ties in both directions",
    async ({ field, direction, ids }) => {
      const source = `query($after: String, $before: String, $first: Int, $last: Int) {
      ${field}(first:$first, last:$last, after:$after, before:$before, orderBy:{field:CREATED_AT, direction:${direction}}) {
        totalCount edges {node{id}} pageInfo{startCursor endCursor hasNextPage}
      }
    }`;
      const first = (await query(source, { first: 2 })).body;
      expect(first.errors).toBeUndefined();
      expect(first.data[field].totalCount).toBe(4);
      expect(nodeIds(first.data[field].edges)).toEqual(ids.slice(0, 2).map(id));
      const second = (
        await query(source, {
          first: 2,
          after: first.data[field].pageInfo.endCursor,
        })
      ).body;
      expect(second.errors).toBeUndefined();
      expect(second.data[field].totalCount).toBe(4);
      expect(nodeIds(second.data[field].edges)).toEqual(ids.slice(2).map(id));
      expect(second.data[field].pageInfo.hasNextPage).toBe(false);
      const previous = (
        await query(source, {
          last: 2,
          before: second.data[field].pageInfo.startCursor,
        })
      ).body;
      expect(previous.errors).toBeUndefined();
      expect(nodeIds(previous.data[field].edges)).toEqual(
        ids.slice(0, 2).map(id),
      );
    },
  );

  it.each([undefined, null])(
    "defaults missing or null ordering (%s) to newest-first compound cursors",
    async (orderBy) => {
      const source = `query($orderBy:JobOrder,$after:String){userJobs(first:2,after:$after,orderBy:$orderBy){edges{node{id}} pageInfo{endCursor}}}`;
      const first = (await query(source, { orderBy })).body;
      expect(first.errors).toBeUndefined();
      expect(nodeIds(first.data.userJobs.edges)).toEqual([5, 6].map(id));
      const cursor = JSON.parse(
        Buffer.from(
          first.data.userJobs.pageInfo.endCursor,
          "base64",
        ).toString(),
      );
      expect(cursor.value).toBe("2026-01-02T00:00:00.000Z");
      const second = (
        await query(source, {
          orderBy,
          after: first.data.userJobs.pageInfo.endCursor,
        })
      ).body;
      expect(second.errors).toBeUndefined();
      expect(nodeIds(second.data.userJobs.edges)).toEqual([3, 1].map(id));
    },
  );

  it.each([
    "ID",
    "QUEUE",
    "NAME",
    "STATUS",
    "STARTED_AT",
    "FINISHED_AT",
    "PROGRESS",
  ])("rejects unsupported sorting by %s", async (field) => {
    const { body } = await query(
      `{userJobs(first:10,orderBy:{field:${field},direction:ASC}){totalCount}}`,
    );
    expect(body.errors[0].extensions.code).toBe("GRAPHQL_VALIDATION_FAILED");
  });

  it("combines scope with filters and searches without widening counts", async () => {
    const { body } = await query(
      `query($filter:JobFilter){userJobs(first:20,filter:$filter,query:"name:generate-report"){totalCount edges{node{id}}}}`,
      {
        filter: {
          $or: [{ queue: "reports" }, { queue: "exports" }],
          status: "completed",
          created_at: { $gte: "2026-01-01T00:00:00Z" },
        },
      },
    );
    expect(body.errors).toBeUndefined();
    expect(body.data.userJobs.totalCount).toBe(3);
    expect(nodeIds(body.data.userJobs.edges)).toEqual([6, 3, 1].map(id));
  });

  it("rejects identity filtering outside the declared fields", async () => {
    const { body } = await query(
      "query($filter:JobFilter){userJobs(first:10,filter:$filter){totalCount}}",
      { filter: { data: { userId: "102" } } },
    );
    expect(body.errors).toBeDefined();
    expect(body.data).toBeUndefined();
  });

  it("isolates identities between parallel HTTP requests", async () => {
    const source = "{userJobs(first:10){totalCount edges{node{id}}}}";
    const [first, second] = await Promise.all([
      query(source),
      query(source).set("x-test-user", "102").set("x-test-workspace", ""),
    ]);
    expect(first.body.errors).toBeUndefined();
    expect(second.body.errors).toBeUndefined();
    expect(first.body.data.userJobs.totalCount).toBe(4);
    expect(second.body.data.userJobs.totalCount).toBe(2);
    expect(nodeIds(second.body.data.userJobs.edges)).toEqual([4, 2].map(id));
  });

  it("keeps payloads, results, errors and internal identifiers private", async () => {
    const { body } = await query('{__type(name:"Job"){fields{name}}}');
    const fields = fieldNames(body.data.__type.fields);
    for (const field of [
      "data",
      "returnValue",
      "failedReason",
      "jobId",
      "lastEventMs",
      "lastEventSeq",
    ]) {
      expect(fields).not.toContain(field);
    }
    const result = (await query(`{userJob(id:"${id(1)}"){progress}}`)).body;
    expect(result.data.userJob.progress).toBeNull();
  });
});
