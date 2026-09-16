import { Migration } from '@mikro-orm/migrations';

export class Migration20260915073637 extends Migration {
  override name = 'Migration20260915073637';

  override up(): void | Promise<void> {
    this.addSql(
      `alter table "member" drop constraint "member_email_workspace_id_unique";`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "member" add constraint "member_email_workspace_id_unique" unique ("email", "workspace_id");`,
    );
  }
}
