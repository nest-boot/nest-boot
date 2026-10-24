import { t } from '@mikro-orm/core';
import {
  Check,
  Entity,
  Index,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';

/** Preserves the v8 Redis job mirror; current queue APIs use the built-in Job entity. */
@Entity({
  tableName: 'redis_job',
  schema: 'queue_legacy',
  readonly: true,
  policies: [
    {
      name: 'job_all_policy',
      roles: ['authenticated'],
      using: `("data" ->> 'userId' = nullif(current_setting('app.user.id', true), '') OR "data" ->> 'workspaceId' = nullif(current_setting('app.workspace.id', true), ''))`,
      check: `("data" ->> 'userId' = nullif(current_setting('app.user.id', true), '') OR "data" ->> 'workspaceId' = nullif(current_setting('app.workspace.id', true), ''))`,
    },
  ],
})
@Check({
  name: 'job_status_check',
  expression: `"status" in ('active', 'completed', 'delayed', 'failed', 'prioritized', 'unknown', 'waiting', 'waiting-children')`,
})
@Index({ name: 'job_name_index', properties: ['name'] })
@Index({ name: 'job_status_index', properties: ['status'] })
@Index({ name: 'job_created_at_index', properties: ['createdAt'] })
@Index({ name: 'job_updated_at_index', properties: ['updatedAt'] })
export class LegacyJob {
  @PrimaryKey({ type: t.string })
  id!: string;

  @Property({ type: t.string })
  queueName!: string;

  @Property({ type: t.string })
  name!: string;

  @Property({ type: t.json })
  data!: unknown;

  @Property({ type: t.json, nullable: true })
  returnValue!: unknown;

  @Property({ type: t.string, nullable: true })
  failedReason!: string | null;

  @Property({ type: t.integer })
  priority!: number;

  @Property({ type: t.json })
  progress!: unknown;

  @Property({ type: t.text })
  status!: string;

  @Property({ type: t.datetime, nullable: true })
  startedAt!: Date | null;

  @Property({ type: t.datetime, nullable: true })
  finishedAt!: Date | null;

  @Property({ type: t.datetime, defaultRaw: 'now()' })
  createdAt!: Date;

  @Property({ type: t.datetime, defaultRaw: 'now()' })
  updatedAt!: Date;
}
