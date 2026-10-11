import { Migration } from '@mikro-orm/migrations';

/** Adds ownership indexes and authenticated reads after BullMQ's migrations. */
export class Migration20261011160256_JobIndexes extends Migration {
  override name = 'Migration20261011160256_JobIndexes';

  override up(): void {
    this.addSql(
      `create index "job_queue_workspace_idx" on "bullmq"."job" ("queue", ("data"->>'workspaceId'));`,
    );
    this.addSql(
      `create index "job_queue_user_idx" on "bullmq"."job" ("queue", ("data"->>'userId'));`,
    );
    this.addSql('grant usage on schema bullmq to authenticated;');
    this.addSql('grant select on bullmq.job to authenticated;');
  }

  override down(): void {
    // Preserve read grants used by existing deployments without these indexes.
    this.addSql(`drop index "bullmq"."job_queue_workspace_idx";`);
    this.addSql(`drop index "bullmq"."job_queue_user_idx";`);
  }
}
