import { EntityManager } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/pglite';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { AuthGuard, Session, User, Workspace } from '@nest-boot/auth';
import { GraphQLModule } from '@nest-boot/graphql';
import { ConnectionManager } from '@nest-boot/graphql-connection';
import { JobStatus } from '@nest-boot/queue-database';
import { RequestContext } from '@nest-boot/request-context';
import type { INestApplication } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import { Job } from '../src/app/jobs/entities/job.entity.js';
import { JobResolver } from '../src/app/jobs/job.resolver.js';
import { JobService } from '../src/app/jobs/job.service.js';

describe('example Job GraphQL API with native RLS', () => {
  let app: INestApplication;
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      dbName: 'memory://',
      entities: [Job],
      metadataProvider: TsMorphMetadataProvider,
      metadataCache: { enabled: false },
      context: () =>
        RequestContext.isActive()
          ? RequestContext.get(EntityManager)
          : undefined,
    });
    await orm.em.execute('create role anonymous nologin');
    await orm.em.execute('create role authenticated nologin');
    await orm.schema.create();
    await orm.em.execute('grant all on job to anonymous, authenticated');
    await orm.em.fork().insertMany(Job, [
      {
        id: 'reports:1',
        queueName: 'reports',
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
        queueName: 'exports',
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
        queueName: 'reports',
        name: 'generate-report',
        data: { userId: '101', workspaceId: '201' },
        status: JobStatus.WAITING,
        progress: 0,
        priority: 0,
        createdAt: new Date('2026-01-03T00:00:00Z'),
      },
      {
        id: 'reports:4',
        queueName: 'reports',
        name: 'generate-report',
        data: { userId: '102', workspaceId: '202' },
        status: JobStatus.COMPLETED,
        progress: 100,
        priority: 0,
        createdAt: new Date('2026-01-04T00:00:00Z'),
      },
      {
        id: 'schedule:5',
        queueName: 'schedule',
        name: 'cleanup',
        data: {},
        status: JobStatus.COMPLETED,
        progress: 100,
        priority: 0,
        createdAt: new Date('2026-01-05T00:00:00Z'),
      },
    ]);

    const service = new JobService(orm.em, new ConnectionManager(orm.em));
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
    // real AuthGuard, GraphQL transport, request EM and PostgreSQL RLS execute.
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

  it('returns a single owned job with JSON payload, progress, result and enum status', async () => {
    const { body } = await query(
      `query { job(id: "reports:1") { id queueName name data progress returnValue status priority failedReason startedAt finishedAt createdAt updatedAt } }`,
    );
    expect(body.errors).toBeUndefined();
    expect(body).toHaveProperty('data');
    expect(body.data.job).toMatchObject({
      id: 'reports:1',
      queueName: 'reports',
      name: 'generate-report',
      data: { userId: '101', workspaceId: '202', format: 'csv' },
      progress: { done: 10 },
      returnValue: { rows: 10 },
      status: 'COMPLETED',
      priority: 2,
      failedReason: null,
      startedAt: null,
      finishedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it.each(['reports:4', 'schedule:5', 'reports:missing'])(
    'returns null for inaccessible or missing job %s',
    async (id) => {
      const { body } = await query(
        'query($id: ID!) { job(id: $id) { id data } }',
        { id },
      );
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

  it('paginates across queues with RLS-scoped counts and stable cursors in both directions', async () => {
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
          queue_name: 'reports',
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
      `query { jobs(first: 10, query: "name:export-report") { edges { node { id progress returnValue failedReason } } } }`,
    );
    expect(body.errors).toBeUndefined();
    expect(body.data.jobs.edges).toEqual([
      {
        node: {
          id: 'exports:2',
          progress: 20,
          returnValue: null,
          failedReason: 'Export failed',
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
