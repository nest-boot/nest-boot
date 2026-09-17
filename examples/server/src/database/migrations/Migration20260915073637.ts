import { Migration } from '@mikro-orm/migrations';

export class Migration20260915073637 extends Migration {
  override name = 'Migration20260915073637';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "member" drop constraint "member_email_workspace_id_unique";`,
    );
  }

  override down(): void | Promise<void> {
    // Shared contact emails are valid data and cannot be deduplicated safely.
    throw new Error(
      'Migration20260915073637 is irreversible: restoring contact-email uniqueness requires an explicit data-preserving migration.',
    );
  }
}
