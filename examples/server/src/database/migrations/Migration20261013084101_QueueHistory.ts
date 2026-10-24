import { Migration } from '@mikro-orm/migrations';

/** Creates optional Job history before the existing index and RLS migrations. */
export class Migration20261013084101_QueueHistory extends Migration {
  override name = 'Migration20261013084101_QueueHistory';

  override up(): void {
    this.addSql('create schema if not exists "bullmq";');
    this.addSql(
      `create table if not exists "bullmq"."job" ("id" uuid not null default gen_random_uuid(), "queue" text not null, "job_id" text not null, "last_event_ms" bigint not null default '0', "last_event_seq" bigint not null default '0', "seq" bigint not null default '0', "name" text not null, "state" text not null, "data" jsonb not null default '{}', "opts" jsonb not null default '{}', "priority" int not null default 0, "delay_ms" bigint not null default 0, "max_attempts" int not null default 1, "attempts_made" int not null default 0, "attempts_started" int not null default 0, "progress" jsonb null, "return_value" jsonb null, "failed_reason" text null, "stacktrace" jsonb null, "deferred_failure" text null, "processed_by" text null, "added_at_ms" bigint not null, "process_at_ms" bigint null, "processed_at_ms" bigint null, "finished_at_ms" bigint null, "lock_token" text null, "locked_until_ms" bigint null, "stalled_count" int not null default 0, "dedup_id" text null, "scheduler_id" text null, "parent_queue" text null, "parent_id" text null, "parent_key" text null, "pending_deps" int not null default 0, "stalled_marked" boolean not null default false, primary key ("id"), constraint "job_queue_job_id_unique" unique ("queue", "job_id"), constraint "job_state_check" check ("state" in ('prioritized', 'unknown', 'waiting', 'active', 'completed', 'failed', 'delayed', 'waiting-children')));`,
    );
  }

  override down(): void {
    this.addSql('drop table if exists "bullmq"."job";');
  }
}
