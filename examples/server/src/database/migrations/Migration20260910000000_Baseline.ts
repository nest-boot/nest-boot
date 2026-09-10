import { Migration } from '@mikro-orm/migrations';

/** 当前实体、原生策略和数据库角色的初始迁移。 */
export class Migration20260910000000_Baseline extends Migration {
  override name = 'Migration20260910000000_Baseline';

  override up(): void | Promise<void> {
    this.addSql(
      `do \$\$ begin if not exists (select 1 from pg_roles where rolname = 'anonymous') then create role anonymous nologin; end if; end \$\$;`,
    );
    this.addSql(
      `do \$\$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if; end \$\$;`,
    );
    this.addSql(`grant anonymous, authenticated to current_user;`);
    this.addSql(`grant usage on schema public to anonymous, authenticated;`);
    this.addSql(
      `create table "user" ("id" bigserial primary key, "name" varchar(255) not null, "email" varchar(255) not null, "email_verified" boolean not null, "image" varchar(255) null, "permissions" text[] not null, "roles" text[] not null, "banned" boolean not null default false, "ban_reason" varchar(255) null, "ban_expires_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now());`,
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
      `create table "api_key" ("id" bigserial primary key, "owner_type" varchar(255) not null, "owner_id" bigint not null, "name" varchar(255) not null, "start" varchar(255) null, "prefix" varchar(255) null, "key" text not null, "enabled" boolean not null default true, "permissions" text[] not null default '{}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "last_used_at" timestamptz null, "expires_at" timestamptz null);`,
    );
    this.addSql(
      `alter table "api_key" add constraint "api_key_key_unique" unique ("key");`,
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
      `create table "account" ("id" uuid not null, "account_id" text not null, "issuer" text not null, "provider_id" text not null, "user_id" bigint not null, "access_token" text null, "refresh_token" text null, "id_token" text null, "access_token_expires_at" timestamptz null, "refresh_token_expires_at" timestamptz null, "scope" text null, "password" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(
      `create index "account_user_id_index" on "account" ("user_id");`,
    );
    this.addSql(
      `alter table "account" add constraint "account_issuer_account_id_unique" unique ("issuer", "account_id");`,
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
      `create table "workspace_member" ("id" bigserial primary key, "user_id" bigint null, "workspace_id" bigint not null, "name" varchar(255) not null, "email" varchar(255) null, "searchable_name" tsvector null, "type" text not null default 'USER', "roles" text[] not null default '{member}', "permissions" text[] not null default '{}', "status" text not null default 'ACTIVE', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now());`,
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
      `alter table "workspace_member" add constraint "workspace_member_user_id_workspace_id_unique" unique ("user_id", "workspace_id");`,
    );
    this.addSql(
      `alter table "workspace_member" add constraint "workspace_member_email_workspace_id_unique" unique ("email", "workspace_id");`,
    );
    this.addSql(`alter table "user" enable row level security;`);
    this.addSql(
      `create policy "user_select_policy" on "user" for select to "authenticated" using (true);`,
    );
    this.addSql(
      `create policy "user_update_policy" on "user" for update to "authenticated" using (id = nullif(current_setting('app.user', true), '')::bigint) with check (id = nullif(current_setting('app.user', true), '')::bigint);`,
    );
    this.addSql(
      `alter table "session" add constraint "session_user_id_foreign" foreign key ("user_id") references "user" ("id");`,
    );
    this.addSql(
      `alter table "session" add constraint "session_impersonated_by_id_foreign" foreign key ("impersonated_by_id") references "user" ("id") on delete set null;`,
    );
    this.addSql(`alter table "api_key" enable row level security;`);
    this.addSql(
      `create policy "api_key_all_policy" on "api_key" to "authenticated" using ((owner_type = 'user' and owner_id = nullif(current_setting('app.user', true), '')::bigint) or (owner_type = 'workspace' and owner_id = nullif(current_setting('app.workspace', true), '')::bigint)) with check ((owner_type = 'user' and owner_id = nullif(current_setting('app.user', true), '')::bigint) or (owner_type = 'workspace' and owner_id = nullif(current_setting('app.workspace', true), '')::bigint));`,
    );
    this.addSql(
      `alter table "account" add constraint "account_user_id_foreign" foreign key ("user_id") references "user" ("id");`,
    );
    this.addSql(
      `alter table "workspace" add constraint "workspace_features_check" check ("features" <@ array['AI'::text]);`,
    );
    this.addSql(`alter table "workspace" enable row level security;`);
    this.addSql(
      `create policy "workspace_select_policy" on "workspace" for select to "authenticated", "anonymous" using (true);`,
    );
    this.addSql(
      `create policy "workspace_update_policy" on "workspace" for update to "authenticated" using (id = nullif(current_setting('app.workspace', true), '')::bigint) with check (id = nullif(current_setting('app.workspace', true), '')::bigint);`,
    );
    this.addSql(
      `create policy "workspace_all_policy" on "workspace" as restrictive using (deleted_at is null) with check (deleted_at is null);`,
    );
    this.addSql(
      `create policy "workspace_delete_policy" on "workspace" as restrictive for delete using (false);`,
    );
    this.addSql(
      `alter table "workspace_invitation" add constraint "workspace_invitation_inviter_id_foreign" foreign key ("inviter_id") references "user" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "workspace_invitation" add constraint "workspace_invitation_workspace_id_foreign" foreign key ("workspace_id") references "workspace" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "workspace_invitation" add constraint "workspace_invitation_status_check" check ("status" in ('accepted', 'canceled', 'pending', 'rejected'));`,
    );
    this.addSql(
      `alter table "workspace_invitation" enable row level security;`,
    );
    this.addSql(
      `create policy "workspace_invitation_all_policy" on "workspace_invitation" to "authenticated" using (workspace_id = nullif(current_setting('app.workspace', true), '')::bigint) with check (workspace_id = nullif(current_setting('app.workspace', true), '')::bigint);`,
    );
    this.addSql(
      `alter table "workspace_member" add constraint "workspace_member_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "workspace_member" add constraint "workspace_member_workspace_id_foreign" foreign key ("workspace_id") references "workspace" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "workspace_member" add constraint "workspace_member_status_check" check ("status" in ('ACTIVE', 'DISABLED'));`,
    );
    this.addSql(
      `alter table "workspace_member" add constraint "workspace_member_type_check" check ("type" in ('USER', 'SERVICE_ACCOUNT'));`,
    );
    this.addSql(`alter table "workspace_member" enable row level security;`);
    this.addSql(
      `create policy "workspace_member_select_policy" on "workspace_member" for select to "authenticated" using (user_id = nullif(current_setting('app.user', true), '')::bigint);`,
    );
    this.addSql(
      `create policy "workspace_member_all_policy" on "workspace_member" to "authenticated" using (workspace_id = nullif(current_setting('app.workspace', true), '')::bigint) with check (workspace_id = nullif(current_setting('app.workspace', true), '')::bigint);`,
    );
    this.addSql(`grant select, update on table "user" to authenticated;`);
    this.addSql(`grant select on table "workspace" to anonymous;`);
    this.addSql(`grant select, update on table "workspace" to authenticated;`);
    this.addSql(
      `grant select, insert, update, delete on table "workspace_member", "workspace_invitation" to authenticated;`,
    );
    this.addSql(
      `grant usage, select on sequence "workspace_member_id_seq" to authenticated;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "session" drop constraint "session_user_id_foreign";`,
    );
    this.addSql(
      `alter table "session" drop constraint "session_impersonated_by_id_foreign";`,
    );
    this.addSql(
      `alter table "account" drop constraint "account_user_id_foreign";`,
    );
    this.addSql(
      `alter table "workspace_invitation" drop constraint "workspace_invitation_inviter_id_foreign";`,
    );
    this.addSql(
      `alter table "workspace_member" drop constraint "workspace_member_user_id_foreign";`,
    );
    this.addSql(
      `alter table "workspace_invitation" drop constraint "workspace_invitation_workspace_id_foreign";`,
    );
    this.addSql(
      `alter table "workspace_member" drop constraint "workspace_member_workspace_id_foreign";`,
    );
    this.addSql(`drop table if exists "user" cascade;`);
    this.addSql(`drop table if exists "session" cascade;`);
    this.addSql(`drop table if exists "api_key" cascade;`);
    this.addSql(`drop table if exists "account" cascade;`);
    this.addSql(`drop table if exists "verification" cascade;`);
    this.addSql(`drop table if exists "workspace" cascade;`);
    this.addSql(`drop table if exists "workspace_invitation" cascade;`);
    this.addSql(`drop table if exists "workspace_member" cascade;`);
  }
}
