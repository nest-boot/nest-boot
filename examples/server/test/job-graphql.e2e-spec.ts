import { EntityManager } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/pglite';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { AuthGuard, Session, User, Workspace } from '@nest-boot/auth';
import { GraphQLModule } from '@nest-boot/graphql';
import { JobStatus } from '@nest-boot/queue';
import { JobConnectionService, JobResolver } from '@nest-boot/queue/graphql';
import {
  entities,
  getJobSchemaOptions,
  Job,
} from '@nest-boot/queue/persistence';
import { RequestContext } from '@nest-boot/request-context';
import type { INestApplication } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { runMigrations } from 'bullmq';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import { getJobReadFilter } from '../src/app/jobs/job-access.js';

describe('example Job GraphQL API with native BullMQ tables', () => {
  let app: INestApplication;
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      dbName: 'memory://',
      entities,
      ...getJobSchemaOptions(),
      metadataProvider: TsMorphMetadataProvider,
      metadataCache: { enabled: false },
      context: () =>
        RequestContext.isActive()
          ? RequestContext.get(EntityManager)
          : undefined,
    });
    await orm.em.execute('create role anonymous nologin');
    await orm.em.execute('create role authenticated nologin');
    const client = await orm.em.getConnection().getNativeClient();
    await runMigrations({
      async query<R>(sql: string, params?: readonly unknown[]) {
        if (params?.length) return await client.query<R>(sql, [...params]);
        const results = await client.exec(sql);
        return { rows: (results.at(-1)?.rows ?? []) as R[] };
      },
    });
    await orm.schema.update();
    await orm.em.execute('grant usage on schema bullmq to authenticated');
    await orm.em.execute('grant select on bullmq.job to authenticated');
    const fixtures = [
      {
        id: 'reports:1',
        queue: 'reports',
        name: 'generate-report',
        data: { userId: '101', workspaceId: '202', format: 'csv' },
        status: JobStatus.COMPLETED,
        returnValue: { rows: 10 },
        progress: { done: 10 },
        priority: 2,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'exports:2',
        queue: 'exports',
        name: 'export-report',
        data: { userId: '102', workspaceId: '201' },
        status: JobStatus.FAILED,
        failedReason: 'Export failed',
        progress: 20,
        priority: 0,
        createdAt: new Date('2026-01-02T00:00:00Z'),
      },
      {
        id: 'reports:3',
        queue: 'reports',
        name: 'generate-report',
        data: { userId: '101', workspaceId: '201' },
        status: JobStatus.WAITING,
        progress: 0,
        priority: 7,
        createdAt: new Date('2026-01-03T00:00:00Z'),
      },
      {
        id: 'reports:4',
        queue: 'reports',
        name: 'generate-report',
        data: { userId: '102', workspaceId: '202' },
        status: JobStatus.COMPLETED,
        progress: 100,
        priority: 0,
        createdAt: new Date('2026-01-04T00:00:00Z'),
      },
      {
        id: 'schedule:5',
        queue: 'schedule',
        name: 'cleanup',
        data: { userId: '101', workspaceId: '201' },
        status: JobStatus.COMPLETED,
        progress: 100,
        priority: 0,
        createdAt: new Date('2026-01-05T00:00:00Z'),
      },
    ];
    for (const [index, job] of fixtures.entries()) {
      await client.query(
        'insert into bullmq.job (queue, id, seq, name, state, data, priority, progress, return_value, failed_reason, added_at_ms) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [
          job.queue,
          job.id.split(':')[1],
          index + 1,
          job.name,
          job.status,
          JSON.stringify(job.data),
          job.priority,
          JSON.stringify(job.progress),
          JSON.stringify(job.returnValue ?? null),
          job.failedReason ?? null,
          job.createdAt.getTime(),
        ],
      );
    }

    const service = new JobConnectionService(
      orm.em,
      { getJobReadFilter },
      {
        getExposedQueueNames: () => ['reports', 'exports'],
      },
    );
    const module = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot({ autoSchemaFile: true, graphiql: false }),
      ],
      providers: [{ provide: JobResolver, useValue: new JobResolver(service) }],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.useGlobalGuards(
      new AuthGuard(module.get(Reflector), {}, module.get(ModuleRef)),
    );
    // Test-only identity fixtures replace authentication middleware, while the
    // real AuthGuard, GraphQL transport, request EM and JobService authorization execute.
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const authenticated = req.header('x-test-authenticated') === 'true';
      const userId = req.header('x-test-user') ?? '101';
      const workspaceId = req.header('x-test-workspace') ?? '201';
      const context = new RequestContext({ type: 'http' });
      context.set(
        EntityManager,
        orm.em.fork({
          session: {
            role: authenticated ? 'authenticated' : 'anonymous',
            variables: {
              'app.user.id': userId,
              'app.workspace.id': workspaceId,
            },
          },
        }),
      );
      if (authenticated) {
        context.set(Session, new Session());
        context.set(User, Object.assign(new User(), { id: userId }));
        if (workspaceId)
          context.set(
            Workspace,
            Object.assign(new Workspace(), { id: workspaceId }),
          );
      }
      void RequestContext.run(context, () => {
        next();
      });
    });
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app?.close();
    await orm?.close();
  });

  /**
   * Returns graphQL request with the selected authentication state.
   * @param source - Source value to read from.
   * @param variables - GraphQL variables sent with the operation.
   * @param authenticated - Whether the test request is authenticated.
   * @returns GraphQL request with the selected authentication state.
   */
  function query(
    source: string,
    variables: Record<string, unknown> = {},
    authenticated = true,
  ) {
    return request(app.getHttpServer())
      .post('/api/graphql')
      .set('x-test-authenticated', String(authenticated))
      .send({ query: source, variables });
  }

  it('returns public job metadata without exposing object progress', async () => {
    const { body } = await query(
      `query { job(id: "reports:1") { id queue name progress status startedAt finishedAt createdAt } }`,
    );
    expect(body.errors).toBeUndefined();
    expect(body).toHaveProperty('data');
    expect(body.data.job).toEqual({
      id: 'reports:1',
      queue: 'reports',
      name: 'generate-report',
      progress: null,
      status: 'COMPLETED',
      startedAt: null,
      finishedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('defines only the public Job fields and numeric progress', async () => {
    const { body } = await query(`query {
      __type(name: "Job") { fields { name type { kind name } } }
    }`);
    expect(body.errors).toBeUndefined();
    expect(body.data.__type.fields.map((field) => field.name).sort()).toEqual([
      'createdAt',
      'finishedAt',
      'id',
      'name',
      'progress',
      'queue',
      'startedAt',
      'status',
    ]);
    expect(
      body.data.__type.fields.find((field) => field.name === 'progress').type,
    ).toEqual({
      kind: 'SCALAR',
      name: 'Float',
    });
  });

  it('uses the six database states and includes priority jobs in waiting filters', async () => {
    const { body } = await query(`query {
      __type(name: "JobStatus") { enumValues { name } }
      job(id: "reports:3") { status }
      jobs(first: 10, filter: { status: "waiting" }) { totalCount edges { node { id status } } }
    }`);
    expect(body.errors).toBeUndefined();
    expect(
      body.data.__type.enumValues.map((value) => value.name).sort(),
    ).toEqual([
      'ACTIVE',
      'COMPLETED',
      'DELAYED',
      'FAILED',
      'WAITING',
      'WAITING_CHILDREN',
    ]);
    expect(body.data.job.status).toBe('WAITING');
    expect(body.data.jobs.totalCount).toBe(1);
    expect(body.data.jobs.edges).toEqual([
      { node: { id: 'reports:3', status: 'WAITING' } },
    ]);
  });

  it.each([
    'job(id: "reports:1") { jobId data returnValue failedReason priority opts stacktrace lockToken }',
    'jobs(first: 10) { edges { node { jobId data returnValue failedReason priority opts stacktrace lockToken } } }',
  ])('rejects private fields in %s', async (selection) => {
    const { body } = await query(`query { ${selection} }`);
    expect(body.data).toBeUndefined();
    expect(body.errors).toHaveLength(8);
    for (const error of body.errors)
      expect(error.message).toContain('Cannot query field');
  });

  it.each([
    [0, 0],
    [42.5, 42.5],
    [100, 100],
    ['private message', null],
    [true, null],
    [{ internalDetail: 'private message' }, null],
    [null, null],
  ])(
    'returns only numeric progress for %j in single and connection queries',
    async (progress, expected) => {
      try {
        await orm.em.execute(
          'update bullmq.job set progress = ?::jsonb where queue = ? and id = ?',
          [JSON.stringify(progress), 'reports', '3'],
        );
        const { body } = await query(`query {
        job(id: "reports:3") { progress }
        jobs(first: 10, filter: { status: "waiting" }) { edges { node { id progress } } }
      }`);
        expect(body.errors).toBeUndefined();
        expect(body.data.job.progress).toBe(expected);
        expect(body.data.jobs.edges).toEqual([
          { node: { id: 'reports:3', progress: expected } },
        ]);
      } finally {
        await orm.em.execute(
          "update bullmq.job set progress = '0'::jsonb where queue = 'reports' and id = '3'",
        );
      }
    },
  );

  it.each(['reports:4', 'schedule:5', 'reports:missing'])(
    'returns null for inaccessible or missing job %s',
    async (id) => {
      const { body } = await query('query($id: ID!) { job(id: $id) { id } }', {
        id,
      });
      expect(body.errors).toBeUndefined();
      expect(body.data.job).toBeNull();
    },
  );

  it.each([
    'query { job(id: "reports:1") { id } }',
    'query { jobs(first: 10) { totalCount edges { node { id } } } }',
  ])('requires authentication for %s', async (source) => {
    const { body } = await query(source, {}, false);
    expect(body.errors[0].extensions.code).toBe('UNAUTHORIZED');
  });

  it('paginates across queues with identity-scoped counts and stable cursors in both directions', async () => {
    const source = `query($after: String, $before: String, $first: Int, $last: Int) {
      jobs(first: $first, last: $last, after: $after, before: $before, orderBy: {field: CREATED_AT, direction: ASC}) {
        totalCount totalCountRelation edges { cursor node { id } }
        pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      }
    }`;
    const first = (await query(source, { first: 2 })).body;
    expect(first.errors).toBeUndefined();
    expect(first.data.jobs.totalCount).toBe(3);
    expect(first.data.jobs.edges.map(({ node }) => node.id)).toEqual([
      'reports:1',
      'exports:2',
    ]);
    expect(first.data.jobs.pageInfo.hasNextPage).toBe(true);
    const second = (
      await query(source, {
        first: 2,
        after: first.data.jobs.pageInfo.endCursor,
      })
    ).body;
    expect(second.errors).toBeUndefined();
    expect(second.data.jobs.edges.map(({ node }) => node.id)).toEqual([
      'reports:3',
    ]);
    expect(second.data.jobs.pageInfo.hasNextPage).toBe(false);
    const previous = (
      await query(source, {
        last: 2,
        before: second.data.jobs.pageInfo.startCursor,
      })
    ).body;
    expect(previous.errors).toBeUndefined();
    expect(previous.data.jobs.edges.map(({ node }) => node.id)).toEqual([
      'reports:1',
      'exports:2',
    ]);
  });

  it('filters queues, names, status and dates while hiding foreign matches', async () => {
    const { body } = await query(
      `query($filter: JobFilter!) {
      jobs(first: 10, filter: $filter, orderBy: { field: CREATED_AT, direction: DESC }) {
        totalCount edges { node { id status } }
      }
    }`,
      {
        filter: {
          queue: 'reports',
          name: 'generate-report',
          status: 'completed',
          created_at: { $gte: '2026-01-01T00:00:00Z' },
        },
      },
    );
    expect(body.errors).toBeUndefined();
    expect(body.data.jobs.totalCount).toBe(1);
    expect(body.data.jobs.edges.map(({ node }) => node.id)).toEqual([
      'reports:1',
    ]);
  });

  it('supports text search and queries that omit totalCount', async () => {
    const { body } = await query(
      `query { jobs(first: 10, query: "name:export-report") { edges { node { id progress status } } } }`,
    );
    expect(body.errors).toBeUndefined();
    expect(body.data.jobs.edges).toEqual([
      {
        node: {
          id: 'exports:2',
          progress: 20,
          status: 'FAILED',
        },
      },
    ]);
  });

  it('keeps concurrent request identities isolated', async () => {
    const source =
      'query { jobs(first: 10, orderBy: { field: CREATED_AT, direction: ASC }) { totalCount edges { node { id } } } }';
    const [first, second] = await Promise.all([
      query(source),
      query(source).set('x-test-user', '102').set('x-test-workspace', ''),
    ]);
    expect(first.body.errors).toBeUndefined();
    expect(second.body.errors).toBeUndefined();
    expect(first.body.data.jobs.totalCount).toBe(3);
    expect(second.body.data.jobs.totalCount).toBe(2);
    expect(second.body.data.jobs.edges.map(({ node }) => node.id)).toEqual([
      'exports:2',
      'reports:4',
    ]);
  });

  it('rejects filters outside the declared query fields', async () => {
    const { body } = await query(
      'query($filter: JobFilter) { jobs(first: 10, filter: $filter) { totalCount } }',
      { filter: { data: { userId: '102' } } },
    );
    expect(body.errors).toBeDefined();
    expect(body.data).toBeUndefined();
  });
});
