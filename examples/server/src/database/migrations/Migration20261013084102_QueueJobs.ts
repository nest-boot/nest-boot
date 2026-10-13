import { Migration } from '@mikro-orm/migrations';

export class Migration20261013084102_QueueJobs extends Migration {
  override name = 'Migration20261013084102_QueueJobs';

  override up(): void | Promise<void> {
    this.addSql(
      `create index "job_queue_workspace_idx" on "bullmq"."job" ("queue", ("data"->>'workspaceId'));`,
    );
    this.addSql(
      `create index "job_queue_user_idx" on "bullmq"."job" ("queue", ("data"->>'userId'));`,
    );
    this.addSql(`alter table "bullmq"."job" enable row level security;`);
    this.addSql(
      `create policy "job_select_policy" on "bullmq"."job" for select to "authenticated" using (("data" ->> 'userId' = nullif(current_setting('app.user.id', true), '') OR "data" ->> 'workspaceId' = nullif(current_setting('app.workspace.id', true), '')));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop policy "job_select_policy" on "bullmq"."job";`);

    this.addSql(`drop index "bullmq"."job_queue_workspace_idx";`);
    this.addSql(`drop index "bullmq"."job_queue_user_idx";`);
    this.addSql(`alter table "bullmq"."job" disable row level security;`);
  }
}
