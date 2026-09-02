import { Migration } from '@mikro-orm/migrations';

/** Removes the retired workspace member group model. */
export class Migration20260902062000 extends Migration {
  /** Drops member group data and schema. */
  override async up(): Promise<void> {
    this.addSql(
      `drop table if exists "workspace_member_group_member" cascade;`,
    );
    this.addSql(`drop table if exists "workspace_member_group" cascade;`);
  }

  /** Restores the previous member group schema. */
  override async down(): Promise<void> {
    this.addSql(
      `create table "workspace_member_group" ("id" bigserial primary key, "name" varchar(255) not null, "searchable_name" tsvector null, "description" text null, "searchable_description" tsvector null, "permissions" text[] not null default '{}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "workspace_id" bigint not null);`,
    );
    this.addSql(
      `create index "workspace_member_group_searchable_description_index" on "public"."workspace_member_group" using gin("searchable_description");`,
    );
    this.addSql(
      `create index "workspace_member_group_searchable_name_index" on "public"."workspace_member_group" using gin("searchable_name");`,
    );
    this.addSql(
      `create index "workspace_member_group_created_at_index" on "workspace_member_group" ("created_at");`,
    );
    this.addSql(
      `alter table "workspace_member_group" add constraint "workspace_member_group_name_workspace_id_unique" unique ("name", "workspace_id");`,
    );

    this.addSql(
      `create table "workspace_member_group_member" ("id" bigserial primary key, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "workspace_id" bigint not null, "group_id" bigint not null, "member_id" bigint not null);`,
    );
    this.addSql(
      `create index "workspace_member_group_member_created_at_index" on "workspace_member_group_member" ("created_at");`,
    );
    this.addSql(
      `alter table "workspace_member_group_member" add constraint "workspace_member_group_member_group_id_member_id_unique" unique ("group_id", "member_id");`,
    );

    this.addSql(
      `alter table "workspace_member_group" add constraint "workspace_member_group_workspace_id_foreign" foreign key ("workspace_id") references "workspace" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "workspace_member_group_member" add constraint "workspace_member_group_member_workspace_id_foreign" foreign key ("workspace_id") references "workspace" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "workspace_member_group_member" add constraint "workspace_member_group_member_group_id_foreign" foreign key ("group_id") references "workspace_member_group" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "workspace_member_group_member" add constraint "workspace_member_group_member_member_id_foreign" foreign key ("member_id") references "workspace_member" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "public"."workspace_member_group_member" enable row level security;`,
    );
    this.addSql(
      `grant select, insert, update, delete on table "public"."workspace_member_group_member" to authenticated;`,
    );
    this.addSql(
      `do \$\$ declare sequence_identifier text; begin for sequence_identifier in select pg_get_serial_sequence('"public"."workspace_member_group_member"', columns.column_name) from information_schema.columns where columns.table_schema = 'public' and columns.table_name = 'workspace_member_group_member' and pg_get_serial_sequence('"public"."workspace_member_group_member"', columns.column_name) is not null loop execute format('grant usage, select on sequence %s to authenticated', sequence_identifier); end loop; end \$\$;`,
    );
    this.addSql(
      `create policy workspace_member_group_member_workspace_all_authe_b7fb1_policy on "public"."workspace_member_group_member" as permissive for all to authenticated using (( SELECT app.get_context('workspace_id'::text, NULL::bigint) AS get_context) = workspace_id) with check (( SELECT app.get_context('workspace_id'::text, NULL::bigint) AS get_context) = workspace_id);`,
    );

    this.addSql(
      `alter table "public"."workspace_member_group" enable row level security;`,
    );
    this.addSql(
      `grant select, insert, update, delete on table "public"."workspace_member_group" to authenticated, anonymous;`,
    );
    this.addSql(
      `do \$\$ declare sequence_identifier text; begin for sequence_identifier in select pg_get_serial_sequence('"public"."workspace_member_group"', columns.column_name) from information_schema.columns where columns.table_schema = 'public' and columns.table_name = 'workspace_member_group' and pg_get_serial_sequence('"public"."workspace_member_group"', columns.column_name) is not null loop execute format('grant usage, select on sequence %s to authenticated, anonymous', sequence_identifier); end loop; end \$\$;`,
    );
    this.addSql(
      `create policy workspace_member_group_workspace_all_anonymous_au_a816c_policy on "public"."workspace_member_group" as permissive for all to authenticated, anonymous using (( SELECT app.get_context('workspace_id'::text, NULL::bigint) AS get_context) = workspace_id) with check (( SELECT app.get_context('workspace_id'::text, NULL::bigint) AS get_context) = workspace_id);`,
    );
  }
}
