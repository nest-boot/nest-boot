import { RowLevelSecurityMigration } from '@nest-boot/row-level-security';

export class Migration20260902080630_Baseline extends RowLevelSecurityMigration {
  override name = 'Migration20260902080630_Baseline';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "user" ("id" bigserial primary key, "email_verified" boolean not null default false, "image" text null, "roles" text[] not null default '{user}', "permissions" text[] not null default '{}', "banned" boolean not null default false, "ban_reason" text null, "ban_expires_at" timestamptz null, "name" varchar(255) not null, "email" varchar(255) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now());`,
    );
    this.addSql(
      `alter table "user" add constraint "user_email_unique" unique ("email");`,
    );
    this.addSql(
      `create index "user_created_at_index" on "user" ("created_at");`,
    );

    this.addSql(
      `create table "session" ("id" uuid not null, "token" text not null, "user_id" bigint not null, "expires_at" timestamptz not null, "ip_address" text null, "user_agent" text null, "impersonated_by_id" bigint null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(
      `alter table "session" add constraint "session_token_unique" unique ("token");`,
    );
    this.addSql(
      `create index "session_user_id_index" on "session" ("user_id");`,
    );

    this.addSql(
      `create table "api_key" ("id" bigserial primary key, "name" varchar(255) not null, "start" varchar(255) null, "prefix" varchar(255) null, "key" text not null, "enabled" boolean not null default true, "permissions" text[] not null default '{}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "last_used_at" timestamptz null, "expires_at" timestamptz null, "owner_type" varchar(255) not null, "owner_id" bigint not null);`,
    );
    this.addSql(
      `create index "api_key_created_at_index" on "api_key" ("created_at");`,
    );
    this.addSql(
      `create index "api_key_owner_type_owner_id_index" on "api_key" ("owner_type", "owner_id");`,
    );
    this.addSql(`create index "api_key_prefix_index" on "api_key" ("prefix");`);
    this.addSql(`create index "api_key_key_index" on "api_key" ("key");`);
    this.addSql(
      `alter table "api_key" add constraint "api_key_key_unique" unique ("key");`,
    );

    this.addSql(
      `create table "account" ("id" uuid not null, "account_id" text not null, "issuer" text not null, "provider_id" text not null, "user_id" bigint not null, "access_token" text null, "refresh_token" text null, "id_token" text null, "access_token_expires_at" timestamptz null, "refresh_token_expires_at" timestamptz null, "scope" text null, "password" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(
      `alter table "account" add constraint "account_issuer_account_id_unique" unique ("issuer", "account_id");`,
    );
    this.addSql(
      `create index "account_user_id_index" on "account" ("user_id");`,
    );

    this.addSql(
      `create table "verification" ("id" uuid not null, "identifier" text not null, "value" text not null, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(
      `create index "verification_identifier_index" on "verification" ("identifier");`,
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
      `alter table "workspace" add constraint "workspace_features_check" check ("features" <@ array['AI'::text]);`,
    );

    this.addSql(
      `create table "workspace_invitation" ("id" uuid not null, "email" varchar(255) not null, "roles" text[] not null default '{member}', "status" text not null default 'pending', "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "inviter_id" bigint not null, "workspace_id" bigint not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "workspace_invitation_workspace_id_index" on "workspace_invitation" ("workspace_id");`,
    );
    this.addSql(
      `create index "workspace_invitation_status_index" on "workspace_invitation" ("status");`,
    );
    this.addSql(
      `create index "workspace_invitation_email_index" on "workspace_invitation" ("email");`,
    );
    this.addSql(
      `create index "workspace_invitation_created_at_index" on "workspace_invitation" ("created_at");`,
    );
    this.addSql(
      `create unique index "workspace_invitation_email_workspace_id_unique" on "workspace_invitation" ("email", "workspace_id") where "status" = 'pending';`,
    );
    this.addSql(
      `alter table "workspace_invitation" add constraint "workspace_invitation_status_check" check ("status" in ('accepted', 'canceled', 'pending', 'rejected'));`,
    );
    this.addSql(
      `grant select, insert, update, delete on table "public"."workspace_invitation" to authenticated;`,
    );

    this.addSql(
      `create table "workspace_member" ("id" bigserial primary key, "name" varchar(255) not null, "email" varchar(255) null, "searchable_name" tsvector null, "type" text not null default 'USER', "roles" text[] not null default '{member}', "permissions" text[] not null default '{}', "status" text not null default 'ACTIVE', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "user_id" bigint null, "workspace_id" bigint not null);`,
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
      `alter table "workspace_member" add constraint "workspace_member_email_workspace_id_unique" unique ("email", "workspace_id");`,
    );
    this.addSql(
      `alter table "workspace_member" add constraint "workspace_member_user_id_workspace_id_unique" unique ("user_id", "workspace_id");`,
    );
    this.addSql(
      `alter table "workspace_member" add constraint "workspace_member_type_check" check ("type" in ('USER', 'SERVICE_ACCOUNT'));`,
    );
    this.addSql(
      `alter table "workspace_member" add constraint "workspace_member_status_check" check ("status" in ('ACTIVE', 'DISABLED'));`,
    );

    this.addSql(
      `alter table "session" add constraint "session_user_id_foreign" foreign key ("user_id") references "user" ("id");`,
    );
    this.addSql(
      `alter table "session" add constraint "session_impersonated_by_id_foreign" foreign key ("impersonated_by_id") references "user" ("id") on delete set null;`,
    );

    this.addSql(
      `alter table "account" add constraint "account_user_id_foreign" foreign key ("user_id") references "user" ("id");`,
    );

    this.addSql(
      `alter table "workspace_invitation" add constraint "workspace_invitation_inviter_id_foreign" foreign key ("inviter_id") references "user" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "workspace_invitation" add constraint "workspace_invitation_workspace_id_foreign" foreign key ("workspace_id") references "workspace" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "workspace_member" add constraint "workspace_member_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "workspace_member" add constraint "workspace_member_workspace_id_foreign" foreign key ("workspace_id") references "workspace" ("id") on update cascade on delete cascade;`,
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
      `create policy user_update_policy on "public"."user" as permissive for update to authenticated using ((select nullif(current_setting('app.user_id', true), '')::bigint) = id) with check ((select nullif(current_setting('app.user_id', true), '')::bigint) = id);`,
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
      `create policy workspace_member_user_all_authenticated_policy on "public"."workspace_member" as permissive for all to authenticated using ((select nullif(current_setting('app.user_id', true), '')::bigint) = user_id) with check ((select nullif(current_setting('app.user_id', true), '')::bigint) = user_id);`,
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
      `create policy workspace_member_workspace_all_authenticated_policy on "public"."workspace_member" as permissive for all to authenticated using ((select nullif(current_setting('app.workspace_id', true), '')::bigint) = workspace_id) with check ((select nullif(current_setting('app.workspace_id', true), '')::bigint) = workspace_id);`,
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
      `create policy workspace_update_policy on "public"."workspace" as permissive for update to authenticated using ((select nullif(current_setting('app.workspace_id', true), '')::bigint) = id) with check ((select nullif(current_setting('app.workspace_id', true), '')::bigint) = id);`,
    );
  }

  override down(): void | Promise<void> {
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
    this.addSql(`revoke select on table "public"."user" from authenticated;`);
    this.addSql(
      `revoke select, update on table "public"."user" from authenticated;`,
    );
    this.addSql(
      `revoke select, insert, update, delete on table "public"."workspace_invitation" from authenticated;`,
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
    this.addSql(`drop table if exists "workspace_member" cascade;`);
    this.addSql(`drop table if exists "workspace_invitation" cascade;`);
    this.addSql(`drop table if exists "workspace" cascade;`);
    this.addSql(`drop table if exists "verification" cascade;`);
    this.addSql(`drop table if exists "account" cascade;`);
    this.addSql(`drop table if exists "api_key" cascade;`);
    this.addSql(`drop table if exists "session" cascade;`);
    this.addSql(`drop table if exists "user" cascade;`);
  }
}
