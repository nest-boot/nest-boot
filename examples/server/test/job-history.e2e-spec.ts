import { randomUUID } from 'node:crypto';

import { EntityManager } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/pglite';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { JobStatus } from '@nest-boot/queue-database';
import { RequestContext } from '@nest-boot/request-context';
import { DiscoveryService } from '@nestjs/core';
import type { Job as BullJob } from 'bullmq';

import { QueueDatabaseService } from '../../../packages/queue-database/dist/queue-database.service.js';
import { Job } from '../src/app/jobs/entities/job.entity.js';

describe('example job history RLS', () => {
  let orm: MikroORM;
  let history: QueueDatabaseService;

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
    history = new QueueDatabaseService(
      { getProviders: () => [] } as unknown as DiscoveryService,
      orm.em,
      { jobEntity: Job },
    );
  }, 30000);

  afterAll(async () => {
    await orm?.close();
  });

  const scoped = (
    userId = 'user-a',
    workspaceId = 'workspace-a',
    role = 'authenticated',
  ) =>
    orm.em.fork({
      session: {
        role,
        variables: {
          'app.user.id': userId,
          'app.workspace.id': workspaceId,
        },
      },
    });

  async function persist(data: Record<string, unknown>, queueName = 'reports') {
    const job = {
      id: randomUUID(),
      queueName,
      name: 'generate-report',
      data,
      priority: 0,
      progress: 0,
      timestamp: Date.now(),
      getState: async () => 'waiting',
    } as unknown as BullJob;
    await history.upsertJob(job, 'waiting');
    return { job, id: `${queueName}:${job.id}` };
  }

  it.each([
    { name: 'matching user only', data: { userId: 'user-a' }, allowed: true },
    {
      name: 'matching workspace only',
      data: { workspaceId: 'workspace-a' },
      allowed: true,
    },
    {
      name: 'both match',
      data: { userId: 'user-a', workspaceId: 'workspace-a' },
      allowed: true,
    },
    {
      name: 'matching user in another workspace',
      data: { userId: 'user-a', workspaceId: 'workspace-b' },
      allowed: true,
    },
    {
      name: 'another user in the matching workspace',
      data: { userId: 'user-b', workspaceId: 'workspace-a' },
      allowed: true,
    },
    {
      name: 'neither matches',
      data: { userId: 'user-b', workspaceId: 'workspace-b' },
      allowed: false,
    },
    { name: 'missing identities', data: {}, allowed: false },
    {
      name: 'empty identities',
      data: { userId: '', workspaceId: '' },
      allowed: false,
    },
    {
      name: 'null identities',
      data: { userId: null, workspaceId: null },
      allowed: false,
    },
  ])(
    '$name enforces the user OR workspace rule for reads and writes',
    async ({ data, allowed }) => {
      const { id } = await persist(data);
      const em = scoped();
      expect(await em.count(Job, { id })).toBe(allowed ? 1 : 0);
      expect(await em.nativeUpdate(Job, { id }, { progress: 50 })).toBe(
        allowed ? 1 : 0,
      );
      const insertedId = `reports:${randomUUID()}`;
      const insert = () =>
        em.insert(Job, {
          id: insertedId,
          queueName: 'reports',
          name: 'generate-report',
          data,
          priority: 0,
          progress: 0,
          status: JobStatus.WAITING,
        });
      if (allowed) await insert();
      else await expect(insert()).rejects.toThrow(/row.level security/i);
      expect(await em.nativeDelete(Job, { id })).toBe(allowed ? 1 : 0);
    },
  );

  it('denies anonymous access and empty sessions even when payload identifiers are empty', async () => {
    const matching = await persist({
      userId: 'user-a',
      workspaceId: 'workspace-a',
    });
    const empty = await persist({ userId: '', workspaceId: '' });
    expect(
      await scoped('user-a', 'workspace-a', 'anonymous').count(
        Job,
        matching.id,
      ),
    ).toBe(0);
    for (const id of [matching.id, empty.id]) {
      expect(await scoped('', '').count(Job, id)).toBe(0);
    }
  });

  it('checks the new payload when updating identities', async () => {
    const { id } = await persist({
      userId: 'user-a',
      workspaceId: 'workspace-b',
    });
    const em = scoped();
    await expect(
      em.nativeUpdate(Job, id, {
        data: { userId: 'user-b', workspaceId: 'workspace-b' },
      }),
    ).rejects.toThrow(/row.level security/i);
    expect(
      await em.nativeUpdate(Job, id, {
        data: { userId: 'user-b', workspaceId: 'workspace-a' },
      }),
    ).toBe(1);
  });

  it.each([
    { userId: 'user-a', workspaceId: '', allowed: true },
    { userId: '', workspaceId: 'workspace-a', allowed: true },
    { userId: '', workspaceId: 'workspace-b', allowed: false },
    { userId: 'user-b', workspaceId: '', allowed: false },
  ])(
    'matches user=$userId or workspace=$workspaceId without requiring both session identifiers',
    async ({ userId, workspaceId, allowed }) => {
      const { id } = await persist({
        userId: 'user-a',
        workspaceId: 'workspace-a',
      });
      expect(await scoped(userId, workspaceId).count(Job, id)).toBe(
        allowed ? 1 : 0,
      );
    },
  );

  it('denies requests with unset identity variables', async () => {
    const { id } = await persist({
      userId: 'user-a',
      workspaceId: 'workspace-a',
    });
    const em = orm.em.fork({ session: { role: 'authenticated' } });
    expect(await em.count(Job, id)).toBe(0);
  });

  it('persists jobs emitted from an authenticated request using that request identity scope', async () => {
    const context = new RequestContext({ type: 'http' });
    context.set(EntityManager, scoped());
    const { id } = await RequestContext.run(context, () =>
      persist({ userId: 'user-a', workspaceId: 'workspace-b', format: 'csv' }),
    );
    expect(await scoped().findOneOrFail(Job, id)).toMatchObject({
      data: { userId: 'user-a', workspaceId: 'workspace-b', format: 'csv' },
    });
  });

  it('preserves payloads and completion results across queues and cleans history in the background', async () => {
    const data = {
      userId: 'user-a',
      workspaceId: 'workspace-a',
      format: 'csv',
    };
    const reports = await persist(data);
    const exports = await persist(data, 'exports');
    const completed = {
      ...reports.job,
      progress: 100,
      returnvalue: { rows: 12 },
      processedOn: Date.now() - 1000,
      finishedOn: Date.now(),
      getState: async () => 'completed',
    } as unknown as BullJob;
    await history.upsertJob(completed, 'completed');
    const em = scoped();
    expect(await em.findOneOrFail(Job, reports.id)).toMatchObject({
      data,
      progress: 100,
      status: 'completed',
      returnValue: { rows: 12 },
    });
    expect(await em.count(Job, { id: [reports.id, exports.id] })).toBe(2);
    const admin = orm.em.fork();
    await admin.nativeUpdate(Job, reports.id, {
      updatedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    });
    await history.cleanHistoryJobs();
    expect(await admin.count(Job, reports.id)).toBe(0);
    expect(await admin.count(Job, exports.id)).toBe(1);
  });
});
