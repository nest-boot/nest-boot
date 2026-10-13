import { Migration } from '@mikro-orm/migrations';

/** Grants request reads after Job RLS is installed, and revokes them before rollback. */
export class Migration20261013084103_QueueJobAccess extends Migration {
  override name = 'Migration20261013084103_QueueJobAccess';

  override up(): void {
    this.addSql('grant usage on schema bullmq to authenticated;');
    this.addSql('grant select on bullmq.job to authenticated;');
  }

  override down(): void {
    this.addSql('revoke select on bullmq.job from authenticated;');
    this.addSql('revoke usage on schema bullmq from authenticated;');
  }
}
