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
    this.addSql(
      `alter table "workspace" add constraint "workspace_slug_unique" unique ("slug");`,
    );
    this.addSql(`
      do $workspace_slugs$
      declare
        workspace_id bigint;
        candidate text;
        letters constant text := 'abcdefghijklmnopqrstuvwxyz';
        characters constant text := letters || '0123456789';
      begin
        for workspace_id in select "id" from "workspace" where "slug" is null loop
          loop
            select substr(letters, 1 + floor(random() * length(letters))::int, 1)
              || string_agg(substr(characters, 1 + floor(random() * length(characters))::int, 1), '' order by position)
            into candidate
            from generate_series(1, 7) as positions(position);

            begin
              update "workspace" set "slug" = candidate where "id" = workspace_id;
              exit;
            exception when unique_violation then
              null;
            end;
          end loop;
        end loop;
      end;
      $workspace_slugs$;
    `);
    this.addSql(`alter table "workspace" alter column "slug" set not null;`);
    this.addSql(
      `alter table "workspace" add constraint "workspace_slug_format_check" check (char_length("slug") >= 3 and "slug" ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$');`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "workspace" drop column "slug";`);
    this.addSql(`alter table "user" drop column "username";`);
  }
}
