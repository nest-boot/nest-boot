import { RowLevelSecurityMigration } from '@nest-boot/row-level-security';

export class Migration20260601153226 extends RowLevelSecurityMigration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "user" ("id" bigserial primary key, "email_verified" boolean not null default false, "image" text null, "name" varchar(255) not null, "email" varchar(255) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now());`,
    );
    this.addSql(
      `alter table "user" add constraint "user_email_unique" unique ("email");`,
    );
    this.addSql(
      `create index "user_created_at_index" on "user" ("created_at");`,
    );

    this.addSql(
      `create table "session" ("id" uuid not null, "token" text not null, "user_id" bigint null, "expires_at" timestamptz not null, "ip_address" text null, "user_agent" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "session_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "session" add constraint "session_token_unique" unique ("token");`,
    );

    this.addSql(
      `create table "account" ("id" uuid not null, "account_id" text not null, "provider_id" text not null, "user_id" bigint null, "access_token" text null, "refresh_token" text null, "id_token" text null, "access_token_expires_at" timestamptz null, "refresh_token_expires_at" timestamptz null, "scope" text null, "password" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "account_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "verification" ("id" uuid not null, "identifier" text not null, "value" text not null, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "verification_pkey" primary key ("id"));`,
    );

    this.addSql(
      `create table "workspace" ("id" bigserial primary key, "name" varchar(255) not null, "features" text[] not null default '{}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null);`,
    );
    this.addSql(
      `create index "workspace_deleted_at_index" on "workspace" ("deleted_at");`,
    );
    this.addSql(
      `create index "workspace_created_at_index" on "workspace" ("created_at");`,
    );

    this.addSql(
      `create table "workspace_member" ("id" bigserial primary key, "name" varchar(255) not null, "email" varchar(255) null, "searchable_name" tsvector null, "type" text check ("type" in ('USER', 'SERVICE_ACCOUNT')) not null default 'USER', "role" text check ("role" in ('OWNER', 'ADMIN', 'MEMBER')) not null default 'MEMBER', "permissions" text[] not null default '{}', "invited_by_id" bigint null, "invited_by_user_name" varchar(255) null, "invite_token" text null, "status" text check ("status" in ('ACTIVE', 'INVITING', 'INVITE_EXPIRED', 'DISABLED')) not null default 'ACTIVE', "invite_expires_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "user_id" bigint null, "workspace_id" bigint not null);`,
    );
    this.addSql(
      `create index "workspace_member_searchable_name_index" on "public"."workspace_member" using gin("searchable_name");`,
    );
    this.addSql(
      `create index "workspace_member_type_index" on "workspace_member" ("type");`,
    );
    this.addSql(
      `create index "workspace_member_workspace_id_index" on "workspace_member" ("workspace_id");`,
    );
    this.addSql(
      `create index "workspace_member_user_id_index" on "workspace_member" ("user_id");`,
    );
    this.addSql(
      `create index "workspace_member_created_at_index" on "workspace_member" ("created_at");`,
    );
    this.addSql(
      `create index "workspace_member_invite_token_index" on "workspace_member" ("invite_token");`,
    );
    this.addSql(
      `create index "workspace_member_role_index" on "workspace_member" ("role");`,
    );
    this.addSql(
      `alter table "workspace_member" add constraint "workspace_member_email_workspace_id_unique" unique ("email", "workspace_id");`,
    );
    this.addSql(
      `alter table "workspace_member" add constraint "workspace_member_invite_token_workspace_id_unique" unique ("invite_token", "workspace_id");`,
    );
    this.addSql(
      `alter table "workspace_member" add constraint "workspace_member_user_id_workspace_id_unique" unique ("user_id", "workspace_id");`,
    );

    this.addSql(
      `create table "api_key" ("id" bigserial primary key, "name" varchar(255) not null, "key_id" varchar(255) not null, "key_prefix" varchar(255) not null, "encrypted_secret" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "last_used_at" timestamptz null, "expires_at" timestamptz null, "workspace_id" bigint not null, "member_id" bigint not null);`,
    );
    this.addSql(
      `create index "api_key_created_at_index" on "api_key" ("created_at");`,
    );
    this.addSql(
      `create index "api_key_member_id_index" on "api_key" ("member_id");`,
    );
    this.addSql(
      `create index "api_key_workspace_id_index" on "api_key" ("workspace_id");`,
    );
    this.addSql(
      `create index "api_key_key_prefix_index" on "api_key" ("key_prefix");`,
    );
    this.addSql(`create index "api_key_key_id_index" on "api_key" ("key_id");`);
    this.addSql(
      `alter table "api_key" add constraint "api_key_key_id_unique" unique ("key_id");`,
    );

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
      `alter table "session" add constraint "session_user_id_foreign" foreign key ("user_id") references "user" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "account" add constraint "account_user_id_foreign" foreign key ("user_id") references "user" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "workspace_member" add constraint "workspace_member_invited_by_id_foreign" foreign key ("invited_by_id") references "user" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "workspace_member" add constraint "workspace_member_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "workspace_member" add constraint "workspace_member_workspace_id_foreign" foreign key ("workspace_id") references "workspace" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "api_key" add constraint "api_key_workspace_id_foreign" foreign key ("workspace_id") references "workspace" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "api_key" add constraint "api_key_member_id_foreign" foreign key ("member_id") references "workspace_member" ("id") on update cascade on delete cascade;`,
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
    this.addSql(`create schema if not exists app;`);
    this.addSql(
      `create or replace function app.get_context(context_key text, context_type anyelement) returns anyelement as \$\$ declare context_value text; begin context_value := current_setting('app.' || context_key, true); if context_value is null or context_value = '' then return null; end if; execute format('select \$1::%s', pg_typeof(context_type)::text) using context_value into context_type; return context_type; end; \$\$ language plpgsql stable;`,
    );
    this.addSql(
      `do \$\$ begin if not exists (select 1 from pg_roles where rolname = 'anonymous') then create role anonymous nologin; end if; end \$\$;`,
    );
    this.addSql(`grant anonymous to current_user;`);
    this.addSql(`grant usage on schema app to anonymous;`);
    this.addSql(
      `do \$\$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if; end \$\$;`,
    );
    this.addSql(`grant authenticated to current_user;`);
    this.addSql(`grant usage on schema app to authenticated;`);
    this.addSql(`alter table "public"."api_key" enable row level security;`);
    this.addSql(
      `grant select, insert, update, delete on table "public"."api_key" to authenticated;`,
    );
    this.addSql(
      `do \$\$ declare sequence_identifier text; begin for sequence_identifier in select pg_get_serial_sequence('"public"."api_key"', columns.column_name) from information_schema.columns where columns.table_schema = 'public' and columns.table_name = 'api_key' and pg_get_serial_sequence('"public"."api_key"', columns.column_name) is not null loop execute format('grant usage, select on sequence %s to authenticated', sequence_identifier); end loop; end \$\$;`,
    );
    this.addSql(
      `drop policy if exists api_key_workspace_all_authenticated_policy on "public"."api_key";`,
    );
    this.addSql(
      `create policy api_key_workspace_all_authenticated_policy on "public"."api_key" as permissive for all to authenticated using (( SELECT app.get_context('workspace_id'::text, NULL::bigint) AS get_context) = workspace_id) with check (( SELECT app.get_context('workspace_id'::text, NULL::bigint) AS get_context) = workspace_id);`,
    );
    this.addSql(`alter table "public"."user" enable row level security;`);
    this.addSql(`grant select on table "public"."user" to authenticated;`);
    this.addSql(`drop policy if exists user_select_policy on "public"."user";`);
    this.addSql(
      `create policy user_select_policy on "public"."user" as permissive for select to authenticated using (true);`,
    );
    this.addSql(`alter table "public"."user" enable row level security;`);
    this.addSql(
      `grant select, update on table "public"."user" to authenticated;`,
    );
    this.addSql(`drop policy if exists user_update_policy on "public"."user";`);
    this.addSql(
      `create policy user_update_policy on "public"."user" as permissive for update to authenticated using (( SELECT app.get_context('user_id'::text, NULL::bigint) AS get_context) = id) with check (( SELECT app.get_context('user_id'::text, NULL::bigint) AS get_context) = id);`,
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
      `drop policy if exists workspace_member_group_member_workspace_all_authe_b7fb1_policy on "public"."workspace_member_group_member";`,
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
      `drop policy if exists workspace_member_group_workspace_all_anonymous_au_a816c_policy on "public"."workspace_member_group";`,
    );
    this.addSql(
      `create policy workspace_member_group_workspace_all_anonymous_au_a816c_policy on "public"."workspace_member_group" as permissive for all to authenticated, anonymous using (( SELECT app.get_context('workspace_id'::text, NULL::bigint) AS get_context) = workspace_id) with check (( SELECT app.get_context('workspace_id'::text, NULL::bigint) AS get_context) = workspace_id);`,
    );
    this.addSql(
      `alter table "public"."workspace_member" enable row level security;`,
    );
    this.addSql(
      `grant select, insert, update, delete on table "public"."workspace_member" to authenticated;`,
    );
    this.addSql(
      `do \$\$ declare sequence_identifier text; begin for sequence_identifier in select pg_get_serial_sequence('"public"."workspace_member"', columns.column_name) from information_schema.columns where columns.table_schema = 'public' and columns.table_name = 'workspace_member' and pg_get_serial_sequence('"public"."workspace_member"', columns.column_name) is not null loop execute format('grant usage, select on sequence %s to authenticated', sequence_identifier); end loop; end \$\$;`,
    );
    this.addSql(
      `drop policy if exists workspace_member_user_all_authenticated_policy on "public"."workspace_member";`,
    );
    this.addSql(
      `create policy workspace_member_user_all_authenticated_policy on "public"."workspace_member" as permissive for all to authenticated using (( SELECT app.get_context('user_id'::text, NULL::bigint) AS get_context) = user_id) with check (( SELECT app.get_context('user_id'::text, NULL::bigint) AS get_context) = user_id);`,
    );
    this.addSql(
      `alter table "public"."workspace_member" enable row level security;`,
    );
    this.addSql(
      `grant select, insert, update, delete on table "public"."workspace_member" to authenticated;`,
    );
    this.addSql(
      `do \$\$ declare sequence_identifier text; begin for sequence_identifier in select pg_get_serial_sequence('"public"."workspace_member"', columns.column_name) from information_schema.columns where columns.table_schema = 'public' and columns.table_name = 'workspace_member' and pg_get_serial_sequence('"public"."workspace_member"', columns.column_name) is not null loop execute format('grant usage, select on sequence %s to authenticated', sequence_identifier); end loop; end \$\$;`,
    );
    this.addSql(
      `drop policy if exists workspace_member_workspace_all_authenticated_policy on "public"."workspace_member";`,
    );
    this.addSql(
      `create policy workspace_member_workspace_all_authenticated_policy on "public"."workspace_member" as permissive for all to authenticated using (( SELECT app.get_context('workspace_id'::text, NULL::bigint) AS get_context) = workspace_id) with check (( SELECT app.get_context('workspace_id'::text, NULL::bigint) AS get_context) = workspace_id);`,
    );
    this.addSql(`alter table "public"."workspace" enable row level security;`);
    this.addSql(
      `drop policy if exists soft_delete_delete_policy on "public"."workspace";`,
    );
    this.addSql(
      `create policy soft_delete_delete_policy on "public"."workspace" as restrictive for delete using (false);`,
    );
    this.addSql(`alter table "public"."workspace" enable row level security;`);
    this.addSql(
      `drop policy if exists soft_delete_select_policy on "public"."workspace";`,
    );
    this.addSql(
      `create policy soft_delete_select_policy on "public"."workspace" as restrictive for select using ("deleted_at" is null);`,
    );
    this.addSql(`alter table "public"."workspace" enable row level security;`);
    this.addSql(
      `drop policy if exists soft_delete_update_policy on "public"."workspace";`,
    );
    this.addSql(
      `create policy soft_delete_update_policy on "public"."workspace" as restrictive for update using ("deleted_at" is null) with check (true);`,
    );
    this.addSql(`alter table "public"."workspace" enable row level security;`);
    this.addSql(`grant insert on table "public"."workspace" to authenticated;`);
    this.addSql(
      `do \$\$ declare sequence_identifier text; begin for sequence_identifier in select pg_get_serial_sequence('"public"."workspace"', columns.column_name) from information_schema.columns where columns.table_schema = 'public' and columns.table_name = 'workspace' and pg_get_serial_sequence('"public"."workspace"', columns.column_name) is not null loop execute format('grant usage, select on sequence %s to authenticated', sequence_identifier); end loop; end \$\$;`,
    );
    this.addSql(
      `drop policy if exists workspace_insert_policy on "public"."workspace";`,
    );
    this.addSql(
      `create policy workspace_insert_policy on "public"."workspace" as permissive for insert to authenticated with check (true);`,
    );
    this.addSql(`alter table "public"."workspace" enable row level security;`);
    this.addSql(
      `grant select on table "public"."workspace" to authenticated, anonymous;`,
    );
    this.addSql(
      `drop policy if exists workspace_select_policy on "public"."workspace";`,
    );
    this.addSql(
      `create policy workspace_select_policy on "public"."workspace" as permissive for select to authenticated, anonymous using (true);`,
    );
    this.addSql(`alter table "public"."workspace" enable row level security;`);
    this.addSql(
      `grant select, update on table "public"."workspace" to authenticated;`,
    );
    this.addSql(
      `drop policy if exists workspace_update_policy on "public"."workspace";`,
    );
    this.addSql(
      `create policy workspace_update_policy on "public"."workspace" as permissive for update to authenticated using (( SELECT app.get_context('workspace_id'::text, NULL::bigint) AS get_context) = id) with check (( SELECT app.get_context('workspace_id'::text, NULL::bigint) AS get_context) = id);`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`do \$\$
declare
  policy_count integer;
begin
  if to_regclass('"public"."api_key"') is not null then
    execute 'drop policy if exists api_key_workspace_all_authenticated_policy on "public"."api_key"';

    select count(*) into policy_count
    from pg_policies
    where schemaname = 'public' and tablename = 'api_key';

    if policy_count = 0 then
      execute 'alter table "public"."api_key" disable row level security';
    end if;
  end if;
end
\$\$;`);
    this.addSql(`do \$\$
declare
  policy_count integer;
begin
  if to_regclass('"public"."user"') is not null then
    execute 'drop policy if exists user_select_policy on "public"."user"';

    select count(*) into policy_count
    from pg_policies
    where schemaname = 'public' and tablename = 'user';

    if policy_count = 0 then
      execute 'alter table "public"."user" disable row level security';
    end if;
  end if;
end
\$\$;`);
    this.addSql(`do \$\$
declare
  policy_count integer;
begin
  if to_regclass('"public"."user"') is not null then
    execute 'drop policy if exists user_update_policy on "public"."user"';

    select count(*) into policy_count
    from pg_policies
    where schemaname = 'public' and tablename = 'user';

    if policy_count = 0 then
      execute 'alter table "public"."user" disable row level security';
    end if;
  end if;
end
\$\$;`);
    this.addSql(`do \$\$
declare
  policy_count integer;
begin
  if to_regclass('"public"."workspace_member_group_member"') is not null then
    execute 'drop policy if exists workspace_member_group_member_workspace_all_authe_b7fb1_policy on "public"."workspace_member_group_member"';

    select count(*) into policy_count
    from pg_policies
    where schemaname = 'public' and tablename = 'workspace_member_group_member';

    if policy_count = 0 then
      execute 'alter table "public"."workspace_member_group_member" disable row level security';
    end if;
  end if;
end
\$\$;`);
    this.addSql(`do \$\$
declare
  policy_count integer;
begin
  if to_regclass('"public"."workspace_member_group"') is not null then
    execute 'drop policy if exists workspace_member_group_workspace_all_anonymous_au_a816c_policy on "public"."workspace_member_group"';

    select count(*) into policy_count
    from pg_policies
    where schemaname = 'public' and tablename = 'workspace_member_group';

    if policy_count = 0 then
      execute 'alter table "public"."workspace_member_group" disable row level security';
    end if;
  end if;
end
\$\$;`);
    this.addSql(`do \$\$
declare
  policy_count integer;
begin
  if to_regclass('"public"."workspace_member"') is not null then
    execute 'drop policy if exists workspace_member_user_all_authenticated_policy on "public"."workspace_member"';

    select count(*) into policy_count
    from pg_policies
    where schemaname = 'public' and tablename = 'workspace_member';

    if policy_count = 0 then
      execute 'alter table "public"."workspace_member" disable row level security';
    end if;
  end if;
end
\$\$;`);
    this.addSql(`do \$\$
declare
  policy_count integer;
begin
  if to_regclass('"public"."workspace_member"') is not null then
    execute 'drop policy if exists workspace_member_workspace_all_authenticated_policy on "public"."workspace_member"';

    select count(*) into policy_count
    from pg_policies
    where schemaname = 'public' and tablename = 'workspace_member';

    if policy_count = 0 then
      execute 'alter table "public"."workspace_member" disable row level security';
    end if;
  end if;
end
\$\$;`);
    this.addSql(`do \$\$
declare
  policy_count integer;
begin
  if to_regclass('"public"."workspace"') is not null then
    execute 'drop policy if exists soft_delete_delete_policy on "public"."workspace"';

    select count(*) into policy_count
    from pg_policies
    where schemaname = 'public' and tablename = 'workspace';

    if policy_count = 0 then
      execute 'alter table "public"."workspace" disable row level security';
    end if;
  end if;
end
\$\$;`);
    this.addSql(`do \$\$
declare
  policy_count integer;
begin
  if to_regclass('"public"."workspace"') is not null then
    execute 'drop policy if exists soft_delete_select_policy on "public"."workspace"';

    select count(*) into policy_count
    from pg_policies
    where schemaname = 'public' and tablename = 'workspace';

    if policy_count = 0 then
      execute 'alter table "public"."workspace" disable row level security';
    end if;
  end if;
end
\$\$;`);
    this.addSql(`do \$\$
declare
  policy_count integer;
begin
  if to_regclass('"public"."workspace"') is not null then
    execute 'drop policy if exists soft_delete_update_policy on "public"."workspace"';

    select count(*) into policy_count
    from pg_policies
    where schemaname = 'public' and tablename = 'workspace';

    if policy_count = 0 then
      execute 'alter table "public"."workspace" disable row level security';
    end if;
  end if;
end
\$\$;`);
    this.addSql(`do \$\$
declare
  policy_count integer;
begin
  if to_regclass('"public"."workspace"') is not null then
    execute 'drop policy if exists workspace_insert_policy on "public"."workspace"';

    select count(*) into policy_count
    from pg_policies
    where schemaname = 'public' and tablename = 'workspace';

    if policy_count = 0 then
      execute 'alter table "public"."workspace" disable row level security';
    end if;
  end if;
end
\$\$;`);
    this.addSql(`do \$\$
declare
  policy_count integer;
begin
  if to_regclass('"public"."workspace"') is not null then
    execute 'drop policy if exists workspace_select_policy on "public"."workspace"';

    select count(*) into policy_count
    from pg_policies
    where schemaname = 'public' and tablename = 'workspace';

    if policy_count = 0 then
      execute 'alter table "public"."workspace" disable row level security';
    end if;
  end if;
end
\$\$;`);
    this.addSql(`do \$\$
declare
  policy_count integer;
begin
  if to_regclass('"public"."workspace"') is not null then
    execute 'drop policy if exists workspace_update_policy on "public"."workspace"';

    select count(*) into policy_count
    from pg_policies
    where schemaname = 'public' and tablename = 'workspace';

    if policy_count = 0 then
      execute 'alter table "public"."workspace" disable row level security';
    end if;
  end if;
end
\$\$;`);
    this.addSql(
      `revoke select, insert, update, delete on table "public"."api_key" from authenticated;`,
    );
    this.addSql(
      `do \$\$ declare sequence_identifier text; begin for sequence_identifier in select pg_get_serial_sequence('"public"."api_key"', columns.column_name) from information_schema.columns where columns.table_schema = 'public' and columns.table_name = 'api_key' and pg_get_serial_sequence('"public"."api_key"', columns.column_name) is not null loop execute format('revoke usage, select on sequence %s from authenticated', sequence_identifier); end loop; end \$\$;`,
    );
    this.addSql(`revoke select on table "public"."user" from authenticated;`);
    this.addSql(
      `revoke select, update on table "public"."user" from authenticated;`,
    );
    this.addSql(
      `revoke select, insert, update, delete on table "public"."workspace_member_group_member" from authenticated;`,
    );
    this.addSql(
      `do \$\$ declare sequence_identifier text; begin for sequence_identifier in select pg_get_serial_sequence('"public"."workspace_member_group_member"', columns.column_name) from information_schema.columns where columns.table_schema = 'public' and columns.table_name = 'workspace_member_group_member' and pg_get_serial_sequence('"public"."workspace_member_group_member"', columns.column_name) is not null loop execute format('revoke usage, select on sequence %s from authenticated', sequence_identifier); end loop; end \$\$;`,
    );
    this.addSql(
      `revoke select, insert, update, delete on table "public"."workspace_member_group" from authenticated, anonymous;`,
    );
    this.addSql(
      `do \$\$ declare sequence_identifier text; begin for sequence_identifier in select pg_get_serial_sequence('"public"."workspace_member_group"', columns.column_name) from information_schema.columns where columns.table_schema = 'public' and columns.table_name = 'workspace_member_group' and pg_get_serial_sequence('"public"."workspace_member_group"', columns.column_name) is not null loop execute format('revoke usage, select on sequence %s from authenticated, anonymous', sequence_identifier); end loop; end \$\$;`,
    );
    this.addSql(
      `revoke select, insert, update, delete on table "public"."workspace_member" from authenticated;`,
    );
    this.addSql(
      `do \$\$ declare sequence_identifier text; begin for sequence_identifier in select pg_get_serial_sequence('"public"."workspace_member"', columns.column_name) from information_schema.columns where columns.table_schema = 'public' and columns.table_name = 'workspace_member' and pg_get_serial_sequence('"public"."workspace_member"', columns.column_name) is not null loop execute format('revoke usage, select on sequence %s from authenticated', sequence_identifier); end loop; end \$\$;`,
    );
    this.addSql(
      `revoke select, insert, update, delete on table "public"."workspace_member" from authenticated;`,
    );
    this.addSql(
      `do \$\$ declare sequence_identifier text; begin for sequence_identifier in select pg_get_serial_sequence('"public"."workspace_member"', columns.column_name) from information_schema.columns where columns.table_schema = 'public' and columns.table_name = 'workspace_member' and pg_get_serial_sequence('"public"."workspace_member"', columns.column_name) is not null loop execute format('revoke usage, select on sequence %s from authenticated', sequence_identifier); end loop; end \$\$;`,
    );
    this.addSql(
      `revoke insert on table "public"."workspace" from authenticated;`,
    );
    this.addSql(
      `do \$\$ declare sequence_identifier text; begin for sequence_identifier in select pg_get_serial_sequence('"public"."workspace"', columns.column_name) from information_schema.columns where columns.table_schema = 'public' and columns.table_name = 'workspace' and pg_get_serial_sequence('"public"."workspace"', columns.column_name) is not null loop execute format('revoke usage, select on sequence %s from authenticated', sequence_identifier); end loop; end \$\$;`,
    );
    this.addSql(
      `revoke select on table "public"."workspace" from authenticated, anonymous;`,
    );
    this.addSql(
      `revoke select, update on table "public"."workspace" from authenticated;`,
    );
    this.addSql(`revoke usage on schema app from anonymous;`);
    this.addSql(`revoke anonymous from current_user;`);
    this.addSql(`revoke usage on schema app from authenticated;`);
    this.addSql(`revoke authenticated from current_user;`);
    this.addSql(
      `alter table "session" drop constraint "session_user_id_foreign";`,
    );

    this.addSql(
      `alter table "account" drop constraint "account_user_id_foreign";`,
    );

    this.addSql(
      `alter table "workspace_member" drop constraint "workspace_member_invited_by_id_foreign";`,
    );

    this.addSql(
      `alter table "workspace_member" drop constraint "workspace_member_user_id_foreign";`,
    );

    this.addSql(
      `alter table "workspace_member" drop constraint "workspace_member_workspace_id_foreign";`,
    );

    this.addSql(
      `alter table "api_key" drop constraint "api_key_workspace_id_foreign";`,
    );

    this.addSql(
      `alter table "workspace_member_group" drop constraint "workspace_member_group_workspace_id_foreign";`,
    );

    this.addSql(
      `alter table "workspace_member_group_member" drop constraint "workspace_member_group_member_workspace_id_foreign";`,
    );

    this.addSql(
      `alter table "api_key" drop constraint "api_key_member_id_foreign";`,
    );

    this.addSql(
      `alter table "workspace_member_group_member" drop constraint "workspace_member_group_member_member_id_foreign";`,
    );

    this.addSql(
      `alter table "workspace_member_group_member" drop constraint "workspace_member_group_member_group_id_foreign";`,
    );

    this.addSql(`drop table if exists "user" cascade;`);

    this.addSql(`drop table if exists "session" cascade;`);

    this.addSql(`drop table if exists "account" cascade;`);

    this.addSql(`drop table if exists "verification" cascade;`);

    this.addSql(`drop table if exists "workspace" cascade;`);

    this.addSql(`drop table if exists "workspace_member" cascade;`);

    this.addSql(`drop table if exists "api_key" cascade;`);

    this.addSql(`drop table if exists "workspace_member_group" cascade;`);

    this.addSql(
      `drop table if exists "workspace_member_group_member" cascade;`,
    );
  }
}
