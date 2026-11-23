import { Migration } from '@mikro-orm/migrations';

export class Migration20261123090000_WorkspaceSlugAndUsername extends Migration {
  override name = 'Migration20261123090000_WorkspaceSlugAndUsername';

  override up(): void | Promise<void> {
    this.addSql(`alter table "user" add column "username" varchar(30) null;`);
    this.addSql(
      `alter table "user" add constraint "user_username_unique" unique ("username");`,
    );
    this.addSql(
      `alter table "user" add constraint "user_username_format_check" check (char_length("username") >= 3 and "username" ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$');`,
    );

    this.addSql(`alter table "workspace" add column "slug" varchar(30) null;`);
    this.addSql(`update "workspace" set "slug" = 'workspace-' || "id"::text;`);
    this.addSql(`alter table "workspace" alter column "slug" set not null;`);
    this.addSql(
      `alter table "workspace" add constraint "workspace_slug_unique" unique ("slug");`,
    );
    this.addSql(
      `alter table "workspace" add constraint "workspace_slug_format_check" check (char_length("slug") >= 3 and "slug" ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$');`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "workspace" drop column "slug";`);
    this.addSql(`alter table "user" drop column "username";`);
  }
}
