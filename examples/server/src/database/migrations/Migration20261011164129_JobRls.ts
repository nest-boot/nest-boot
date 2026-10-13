import { Migration } from '@mikro-orm/migrations';

export class Migration20261011164129_JobRls extends Migration {
  override name = 'Migration20261011164129_JobRls';

  override up(): void | Promise<void> {
    this.addSql(`alter table "bullmq"."job" enable row level security;`);
    this.addSql(
      `create policy "job_select_policy" on "bullmq"."job" for select to "authenticated" using (("data" ->> 'userId' = nullif(current_setting('app.user.id', true), '') OR "data" ->> 'workspaceId' = nullif(current_setting('app.workspace.id', true), '')));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop policy "job_select_policy" on "bullmq"."job";`);

    // Keep request-role reads denied while reverting the ownership policy.
    this.addSql(`alter table "bullmq"."job" enable row level security;`);
  }
}
