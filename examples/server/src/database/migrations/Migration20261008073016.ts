import { Migration } from '@mikro-orm/migrations';

export class Migration20261008073016 extends Migration {
  override name = 'Migration20261008073016';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "job" ("id" varchar(255) not null, "queue_name" varchar(255) not null, "name" varchar(255) not null, "data" jsonb not null, "return_value" jsonb null, "failed_reason" varchar(255) null, "priority" int not null, "progress" jsonb not null, "status" text not null, "started_at" timestamptz null, "finished_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(`create index "job_name_index" on "job" ("name");`);
    this.addSql(`create index "job_status_index" on "job" ("status");`);
    this.addSql(`create index "job_created_at_index" on "job" ("created_at");`);
    this.addSql(`create index "job_updated_at_index" on "job" ("updated_at");`);

    this.addSql(
      `alter table "job" add constraint "job_status_check" check ("status" in ('active', 'completed', 'delayed', 'failed', 'prioritized', 'unknown', 'waiting', 'waiting-children'));`,
    );
    this.addSql(`alter table "job" enable row level security;`);
    this.addSql(
      `create policy "job_all_policy" on "job" to "authenticated" using (("data" ->> 'userId' = nullif(current_setting('app.user.id', true), '') OR "data" ->> 'workspaceId' = nullif(current_setting('app.workspace.id', true), ''))) with check (("data" ->> 'userId' = nullif(current_setting('app.user.id', true), '') OR "data" ->> 'workspaceId' = nullif(current_setting('app.workspace.id', true), '')));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "job" cascade;`);
  }
}
