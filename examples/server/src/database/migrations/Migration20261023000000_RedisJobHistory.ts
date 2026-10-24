import { Migration } from '@mikro-orm/migrations';

/** Preserves native PostgreSQL job rows as an archive while introducing UUID history. */
export class Migration20261023000000_RedisJobHistory extends Migration {
  override name = 'Migration20261023000000_RedisJobHistory';

  override up(): void {
    this.addSql(`do $migration$ begin
      create schema if not exists "queue_legacy";
      if to_regclass('public.job') is not null then
        alter table "public"."job" set schema "queue_legacy";
        alter table "queue_legacy"."job" rename to "redis_job";
      end if;
      if exists (select 1 from information_schema.schemata where schema_name = 'bullmq') then
        alter schema "bullmq" rename to "queue_postgres_legacy";
      end if;
create table "job" ("id" uuid not null default gen_random_uuid(), "queue" text not null, "job_id" text not null, "name" text not null, "data" jsonb not null default '{}', "status" text not null, "progress" jsonb null, "return_value" jsonb null, "failed_reason" text null, "created_at" timestamptz not null, "started_at" timestamptz null, "finished_at" timestamptz null, "last_event_ms" bigint not null default '0', "last_event_seq" bigint not null default '0', primary key ("id"));
create index "job_workspace_idx" on "public"."job" (("data"->>'workspaceId'), "created_at", "id");
create index "job_user_idx" on "public"."job" (("data"->>'userId'), "created_at", "id");
alter table "job" add constraint "job_queue_job_id_unique" unique ("queue", "job_id");
alter table "job" add constraint "job_status_check" check ("status" in ('prioritized', 'unknown', 'waiting', 'active', 'completed', 'failed', 'delayed', 'waiting-children'));

create index "job_system_idx" on "public"."job" ("created_at", "id") where "data"->>'userId' is null and "data"->>'workspaceId' is null;

      grant usage on schema "public" to authenticated;
      grant select on "public"."job" to authenticated;
    end $migration$;`);
  }

  override down(): void {
    // Operational jobs must be explicitly migrated before changing transports.
    // Keep both history and the archive rather than deleting synchronized data.
  }
}
