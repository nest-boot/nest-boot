import { Migration } from '@mikro-orm/migrations';

export class Migration20261111092714 extends Migration {
  override name = 'Migration20261111092714';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "job" ("id" uuid not null default gen_random_uuid(), "queue" text not null, "job_id" text not null, "name" text not null, "data" jsonb not null default '{}', "status" text not null, "progress" jsonb null, "return_value" jsonb null, "failed_reason" text null, "created_at" timestamptz not null, "started_at" timestamptz null, "finished_at" timestamptz null, "last_event_ms" bigint not null default '0', "last_event_seq" bigint not null default '0', primary key ("id"));`,
    );
    this.addSql(
      `create index "job_created_at_id_index" on "job" ("created_at", "id") where "data"->>'userId' is null and "data"->>'workspaceId' is null;`,
    );
    this.addSql(
      `create index "job_data_workspaceId_created_at_id_index" on "job" (("data"->>'workspaceId'), created_at, id);`,
    );
    this.addSql(
      `create index "job_data_userId_created_at_id_index" on "job" (("data"->>'userId'), created_at, id);`,
    );
    this.addSql(
      `alter table "job" add constraint "job_queue_job_id_unique" unique ("queue", "job_id");`,
    );

    this.addSql(
      `create table "user" ("id" bigserial primary key, "name" varchar(255) not null, "email" varchar(255) not null, "email_verified" boolean not null, "image" varchar(255) null, "roles" text[] not null, "permissions" text[] not null, "banned" boolean not null default false, "ban_reason" varchar(255) null, "ban_expires_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now());`,
    );
    this.addSql(
      `alter table "user" add constraint "user_email_unique" unique ("email");`,
    );
    this.addSql(
      `create index "user_created_at_index" on "user" ("created_at");`,
    );

    this.addSql(
      `create table "system_account" ("id" bigserial primary key, "name" varchar(255) not null, "enabled" boolean not null default true, "permissions" text[] not null default '{}', "created_by_id" bigint null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now());`,
    );
    this.addSql(
      `create index "system_account_created_at_index" on "system_account" ("created_at");`,
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
      `create table "api_key" ("id" bigserial primary key, "created_by_id" bigint null, "name" varchar(255) not null, "start" varchar(255) null, "prefix" varchar(255) null, "key" text not null, "enabled" boolean not null default true, "permissions" text[] not null default '{}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "last_used_at" timestamptz null, "expires_at" timestamptz null, "owner_type" varchar(255) not null, "owner_id" bigint not null);`,
    );
    this.addSql(
      `alter table "api_key" add constraint "api_key_key_unique" unique ("key");`,
    );
    this.addSql(
      `create index "api_key_created_at_index" on "api_key" ("created_at");`,
    );
    this.addSql(`create index "api_key_prefix_index" on "api_key" ("prefix");`);
    this.addSql(`create index "api_key_key_index" on "api_key" ("key");`);
    this.addSql(
      `create index "api_key_owner_type_owner_id_index" on "api_key" ("owner_type", "owner_id");`,
    );

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
      `create table "workspace" ("id" bigserial primary key, "name" varchar(255) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now());`,
    );
    this.addSql(
      `create index "workspace_created_at_index" on "workspace" ("created_at");`,
    );

    this.addSql(
      `create table "member" ("id" bigserial primary key, "name" varchar(255) not null, "email" varchar(255) null, "roles" text[] not null default '{member}', "type" text not null default 'USER', "status" text not null default 'ACTIVE', "permissions" text[] not null default '{}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "user_id" bigint null, "workspace_id" bigint not null);`,
    );
    this.addSql(
      `create index "member_workspace_id_index" on "member" ("workspace_id");`,
    );
    this.addSql(`create index "member_user_id_index" on "member" ("user_id");`);
    this.addSql(
      `create index "member_created_at_index" on "member" ("created_at");`,
    );
    this.addSql(
      `alter table "member" add constraint "member_user_id_workspace_id_unique" unique ("user_id", "workspace_id");`,
    );

    this.addSql(
      `create table "invitation" ("id" uuid not null, "email" varchar(255) not null, "roles" text[] not null default '{member}', "status" text not null default 'pending', "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "inviter_id" bigint not null, "workspace_id" bigint not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "invitation_workspace_id_index" on "invitation" ("workspace_id");`,
    );
    this.addSql(
      `create index "invitation_status_index" on "invitation" ("status");`,
    );
    this.addSql(
      `create index "invitation_email_index" on "invitation" ("email");`,
    );
    this.addSql(
      `create index "invitation_created_at_index" on "invitation" ("created_at");`,
    );
    this.addSql(
      `create unique index "invitation_email_workspace_id_unique" on "invitation" ("email", "workspace_id") where "status" = 'pending';`,
    );

    this.addSql(
      `alter table "job" add constraint "job_status_check" check ("status" in ('prioritized', 'unknown', 'waiting', 'active', 'completed', 'failed', 'delayed', 'waiting-children'));`,
    );

    this
      .addSql(`create or replace function "public"."user_user_api_key_cleanup_fn"() returns trigger language plpgsql security definer set search_path = pg_catalog as \$\$ begin
      if TG_RELID <> '"public"."user"'::regclass or TG_NAME <> 'user_api_key_cleanup' or TG_OP not in ('DELETE') or TG_WHEN <> 'AFTER' or TG_LEVEL <> 'ROW' then raise exception 'Unexpected API-key trigger target'; end if;       delete from "public"."api_key" where "owner_type" = 'user' and "owner_id" = OLD."id"; return OLD;     end; \$\$;`);
    this.addSql(
      `revoke all on function "public"."user_user_api_key_cleanup_fn"() from public;`,
    );
    this.addSql(
      `create trigger "user_api_key_cleanup" after delete on "public"."user" for each row execute function "public"."user_user_api_key_cleanup_fn"();`,
    );
    this.addSql(`alter table "user" enable row level security;`);
    this.addSql(
      `create policy "user_select_policy" on "user" for select to "authenticated" using (true);`,
    );
    this.addSql(
      `create policy "user_update_policy" on "user" for update to "authenticated" using (true) with check (true);`,
    );
    this.addSql(
      `create policy "user_delete_policy" on "user" for delete to "authenticated" using (true);`,
    );

    this.addSql(
      `alter table "system_account" add constraint "system_account_created_by_id_foreign" foreign key ("created_by_id") references "user" ("id") on delete set null;`,
    );
    this
      .addSql(`create or replace function "public"."system_account_system_account_api_key_cleanup_fn"() returns trigger language plpgsql security definer set search_path = pg_catalog as \$\$ begin
      if TG_RELID <> '"public"."system_account"'::regclass or TG_NAME <> 'system_account_api_key_cleanup' or TG_OP not in ('DELETE') or TG_WHEN <> 'AFTER' or TG_LEVEL <> 'ROW' then raise exception 'Unexpected API-key trigger target'; end if;       delete from "public"."api_key" where "owner_type" = 'system_account' and "owner_id" = OLD."id"; return OLD;     end; \$\$;`);
    this.addSql(
      `revoke all on function "public"."system_account_system_account_api_key_cleanup_fn"() from public;`,
    );
    this.addSql(
      `create trigger "system_account_api_key_cleanup" after delete on "public"."system_account" for each row execute function "public"."system_account_system_account_api_key_cleanup_fn"();`,
    );
    this.addSql(`alter table "system_account" enable row level security;`);
    this.addSql(
      `create policy "system_account_all_policy" on "system_account" to "anonymous", "authenticated" using (false) with check (false);`,
    );

    this.addSql(
      `alter table "session" add constraint "session_user_id_foreign" foreign key ("user_id") references "user" ("id") on delete cascade;`,
    );
    this.addSql(
      `alter table "session" add constraint "session_impersonated_by_id_foreign" foreign key ("impersonated_by_id") references "user" ("id") on delete cascade;`,
    );
    this.addSql(`alter table "session" enable row level security;`);
    this.addSql(
      `create policy "session_select_policy" on "session" for select to "authenticated" using (true);`,
    );

    this.addSql(
      `alter table "api_key" add constraint "api_key_created_by_id_foreign" foreign key ("created_by_id") references "user" ("id") on delete set null;`,
    );
    this.addSql(
      `alter table "api_key" add constraint "api_key_owner_type_check" check ("owner_type" in ('user', 'system_account', 'member'));`,
    );
    this
      .addSql(`create or replace function "public"."api_key_api_key_owner_exists_fn"() returns trigger language plpgsql security definer set search_path = pg_catalog as \$\$ begin
      if TG_RELID <> '"public"."api_key"'::regclass or TG_NAME <> 'api_key_owner_exists' or TG_OP not in ('INSERT', 'UPDATE') or TG_WHEN <> 'AFTER' or TG_LEVEL <> 'ROW' then raise exception 'Unexpected API-key trigger target'; end if;     if TG_OP = 'UPDATE' then
      if NEW."owner_type" is not distinct from OLD."owner_type" and NEW."owner_id" is not distinct from OLD."owner_id" then return NEW; end if;     end if;     if NEW."owner_type" = 'user' then perform 1 from "public"."user" where "id" = NEW."owner_id" for key share;     elsif NEW."owner_type" = 'system_account' then perform 1 from "public"."system_account" where "id" = NEW."owner_id" for key share;     elsif NEW."owner_type" = 'member' then perform 1 from "public"."member" where "id" = NEW."owner_id" for key share;     else raise exception 'Invalid API-key owner type' using errcode = '23514'; end if;     if not found then raise exception 'API-key owner does not exist' using errcode = '23503'; end if;     return NEW;     end; \$\$;`);
    this.addSql(
      `revoke all on function "public"."api_key_api_key_owner_exists_fn"() from public;`,
    );
    this.addSql(
      `create trigger "api_key_owner_exists" after insert or update on "public"."api_key" for each row execute function "public"."api_key_api_key_owner_exists_fn"();`,
    );
    this.addSql(`alter table "api_key" enable row level security;`);
    this.addSql(
      `create policy "api_key_all_policy" on "api_key" to "authenticated" using ((("owner_type" = 'user' AND "owner_id" = nullif(current_setting('app.user.id', true), '')::bigint) OR ("owner_type" = 'member' AND EXISTS (SELECT 1 FROM "member" WHERE "member"."id" = "owner_id" AND "member"."workspace_id" = nullif(current_setting('app.workspace.id', true), '')::bigint)))) with check ((("owner_type" = 'user' AND "owner_id" = nullif(current_setting('app.user.id', true), '')::bigint) OR ("owner_type" = 'member' AND EXISTS (SELECT 1 FROM "member" WHERE "member"."id" = "owner_id" AND "member"."workspace_id" = nullif(current_setting('app.workspace.id', true), '')::bigint))));`,
    );

    this.addSql(
      `alter table "account" add constraint "account_user_id_foreign" foreign key ("user_id") references "user" ("id") on delete cascade;`,
    );
    this.addSql(`alter table "account" enable row level security;`);
    this.addSql(
      `create policy "account_select_policy" on "account" for select to "authenticated" using ("user_id" = nullif(current_setting('app.user.id', true), '')::bigint);`,
    );

    this.addSql(`alter table "verification" enable row level security;`);
    this.addSql(
      `create policy "verification_all_policy" on "verification" to "anonymous", "authenticated" using (false) with check (false);`,
    );

    this.addSql(`alter table "workspace" enable row level security;`);
    this.addSql(
      `create policy "workspace_select_policy" on "workspace" for select to "authenticated", "anonymous" using (true);`,
    );
    this.addSql(
      `create policy "workspace_update_policy" on "workspace" for update to "authenticated" using ("id" = nullif(current_setting('app.workspace.id', true), '')::bigint) with check ("id" = nullif(current_setting('app.workspace.id', true), '')::bigint);`,
    );
    this.addSql(
      `create policy "workspace_delete_policy" on "workspace" for delete to "authenticated" using ("id" = nullif(current_setting('app.workspace.id', true), '')::bigint);`,
    );

    this.addSql(
      `alter table "member" add constraint "member_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "member" add constraint "member_workspace_id_foreign" foreign key ("workspace_id") references "workspace" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "member" add constraint "member_type_user_check" check (("type" = 'USER' AND "user_id" IS NOT NULL) OR ("type" = 'SERVICE_ACCOUNT' AND "user_id" IS NULL));`,
    );
    this.addSql(
      `alter table "member" add constraint "member_type_check" check ("type" in ('USER', 'SERVICE_ACCOUNT'));`,
    );
    this.addSql(
      `alter table "member" add constraint "member_status_check" check ("status" in ('ACTIVE', 'DISABLED'));`,
    );
    this
      .addSql(`create or replace function "public"."member_member_api_key_cleanup_fn"() returns trigger language plpgsql security definer set search_path = pg_catalog as \$\$ begin
      if TG_RELID <> '"public"."member"'::regclass or TG_NAME <> 'member_api_key_cleanup' or TG_OP not in ('DELETE') or TG_WHEN <> 'AFTER' or TG_LEVEL <> 'ROW' then raise exception 'Unexpected API-key trigger target'; end if;       delete from "public"."api_key" where "owner_type" = 'member' and "owner_id" = OLD."id"; return OLD;     end; \$\$;`);
    this.addSql(
      `revoke all on function "public"."member_member_api_key_cleanup_fn"() from public;`,
    );
    this.addSql(
      `create trigger "member_api_key_cleanup" after delete on "public"."member" for each row execute function "public"."member_member_api_key_cleanup_fn"();`,
    );
    this.addSql(`alter table "member" enable row level security;`);
    this.addSql(
      `create policy "member_select_policy" on "member" for select to "authenticated" using ("user_id" = nullif(current_setting('app.user.id', true), '')::bigint);`,
    );
    this.addSql(
      `create policy "member_all_policy" on "member" to "authenticated" using ("workspace_id" = nullif(current_setting('app.workspace.id', true), '')::bigint) with check ("workspace_id" = nullif(current_setting('app.workspace.id', true), '')::bigint);`,
    );

    this.addSql(
      `alter table "invitation" add constraint "invitation_inviter_id_foreign" foreign key ("inviter_id") references "user" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "invitation" add constraint "invitation_workspace_id_foreign" foreign key ("workspace_id") references "workspace" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "invitation" add constraint "invitation_status_check" check ("status" in ('accepted', 'canceled', 'pending', 'rejected'));`,
    );
    this.addSql(`alter table "invitation" enable row level security;`);
    this.addSql(
      `create policy "invitation_all_policy" on "invitation" to "authenticated" using ("workspace_id" = nullif(current_setting('app.workspace.id', true), '')::bigint) with check ("workspace_id" = nullif(current_setting('app.workspace.id', true), '')::bigint);`,
    );
    this.addSql(
      `create policy "invitation_recipient_select_policy" on "invitation" for select to "authenticated" using ("email" = (select lower("recipient"."email") from "user" as "recipient" where "recipient"."id" = nullif(current_setting('app.user.id', true), '')::bigint));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "system_account" drop constraint "system_account_created_by_id_foreign";`,
    );
    this.addSql(
      `alter table "session" drop constraint "session_user_id_foreign";`,
    );
    this.addSql(
      `alter table "session" drop constraint "session_impersonated_by_id_foreign";`,
    );
    this.addSql(
      `alter table "api_key" drop constraint "api_key_created_by_id_foreign";`,
    );
    this.addSql(
      `alter table "account" drop constraint "account_user_id_foreign";`,
    );
    this.addSql(
      `alter table "member" drop constraint "member_user_id_foreign";`,
    );
    this.addSql(
      `alter table "invitation" drop constraint "invitation_inviter_id_foreign";`,
    );
    this.addSql(
      `alter table "member" drop constraint "member_workspace_id_foreign";`,
    );
    this.addSql(
      `alter table "invitation" drop constraint "invitation_workspace_id_foreign";`,
    );

    this.addSql(`drop table if exists "job" cascade;`);
    this.addSql(`drop trigger if exists "user_api_key_cleanup" on "user";`);
    this.addSql(`drop function if exists "user_user_api_key_cleanup_fn"();`);
    this.addSql(`drop table if exists "user" cascade;`);
    this.addSql(
      `drop trigger if exists "system_account_api_key_cleanup" on "system_account";`,
    );
    this.addSql(
      `drop function if exists "system_account_system_account_api_key_cleanup_fn"();`,
    );
    this.addSql(`drop table if exists "system_account" cascade;`);
    this.addSql(`drop table if exists "session" cascade;`);
    this.addSql(`drop trigger if exists "api_key_owner_exists" on "api_key";`);
    this.addSql(`drop function if exists "api_key_api_key_owner_exists_fn"();`);
    this.addSql(`drop table if exists "api_key" cascade;`);
    this.addSql(`drop table if exists "account" cascade;`);
    this.addSql(`drop table if exists "verification" cascade;`);
    this.addSql(`drop table if exists "workspace" cascade;`);
    this.addSql(`drop trigger if exists "member_api_key_cleanup" on "member";`);
    this.addSql(
      `drop function if exists "member_member_api_key_cleanup_fn"();`,
    );
    this.addSql(`drop table if exists "member" cascade;`);
    this.addSql(`drop table if exists "invitation" cascade;`);
  }
}
