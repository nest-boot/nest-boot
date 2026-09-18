import { Migration } from '@mikro-orm/migrations';

export class Migration20260918091003 extends Migration {
  override name = 'Migration20260918091003';

  override up(): void | Promise<void> {
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
      `create table "session" ("id" uuid not null, "token" text not null, "user_id" bigint not null, "expires_at" timestamptz not null, "ip_address" text null, "user_agent" text null, "impersonated_by_id" bigint null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(
      `alter table "session" add constraint "session_token_unique" unique ("token");`,
    );
    this.addSql(
      `create index "session_user_id_index" on "session" ("user_id");`,
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
      `create table "user_api_key" ("id" bigserial primary key, "name" varchar(255) not null, "start" varchar(255) null, "prefix" varchar(255) null, "key" text not null, "enabled" boolean not null default true, "permissions" text[] not null default '{}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "last_used_at" timestamptz null, "expires_at" timestamptz null, "user_id" bigint not null);`,
    );
    this.addSql(
      `alter table "user_api_key" add constraint "user_api_key_key_unique" unique ("key");`,
    );
    this.addSql(
      `create index "user_api_key_user_id_index" on "user_api_key" ("user_id");`,
    );
    this.addSql(
      `create index "user_api_key_created_at_index" on "user_api_key" ("created_at");`,
    );
    this.addSql(
      `create index "user_api_key_prefix_index" on "user_api_key" ("prefix");`,
    );
    this.addSql(
      `create index "user_api_key_key_index" on "user_api_key" ("key");`,
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
      `create table "member" ("id" bigserial primary key, "name" varchar(255) not null, "email" varchar(255) null, "roles" text[] not null default '{member}', "status" text not null default 'ACTIVE', "permissions" text[] not null default '{}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "user_id" bigint not null, "workspace_id" bigint not null);`,
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
      `create table "workspace_api_key" ("id" bigserial primary key, "name" varchar(255) not null, "start" varchar(255) null, "prefix" varchar(255) null, "key" text not null, "enabled" boolean not null default true, "permissions" text[] not null default '{}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "last_used_at" timestamptz null, "expires_at" timestamptz null, "workspace_id" bigint not null);`,
    );
    this.addSql(
      `alter table "workspace_api_key" add constraint "workspace_api_key_key_unique" unique ("key");`,
    );
    this.addSql(
      `create index "workspace_api_key_workspace_id_index" on "workspace_api_key" ("workspace_id");`,
    );
    this.addSql(
      `create index "workspace_api_key_created_at_index" on "workspace_api_key" ("created_at");`,
    );
    this.addSql(
      `create index "workspace_api_key_prefix_index" on "workspace_api_key" ("prefix");`,
    );
    this.addSql(
      `create index "workspace_api_key_key_index" on "workspace_api_key" ("key");`,
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
      `alter table "account" add constraint "account_user_id_foreign" foreign key ("user_id") references "user" ("id") on delete cascade;`,
    );
    this.addSql(`alter table "account" enable row level security;`);
    this.addSql(
      `create policy "account_select_policy" on "account" for select to "authenticated" using ("user_id" = nullif(current_setting('app.user.id', true), '')::bigint);`,
    );

    this.addSql(
      `alter table "user_api_key" add constraint "user_api_key_user_id_foreign" foreign key ("user_id") references "user" ("id") on delete cascade;`,
    );
    this.addSql(`alter table "user_api_key" enable row level security;`);
    this.addSql(
      `create policy "user_api_key_all_policy" on "user_api_key" to "authenticated" using (("user_id" = nullif(current_setting('app.user.id', true), '')::bigint)) with check (("user_id" = nullif(current_setting('app.user.id', true), '')::bigint));`,
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
      `alter table "member" add constraint "member_status_check" check ("status" in ('ACTIVE', 'DISABLED'));`,
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

    this.addSql(
      `alter table "workspace_api_key" add constraint "workspace_api_key_workspace_id_foreign" foreign key ("workspace_id") references "workspace" ("id") on delete cascade;`,
    );
    this.addSql(`alter table "workspace_api_key" enable row level security;`);
    this.addSql(
      `create policy "workspace_api_key_all_policy" on "workspace_api_key" to "authenticated" using (("workspace_id" = nullif(current_setting('app.workspace.id', true), '')::bigint)) with check (("workspace_id" = nullif(current_setting('app.workspace.id', true), '')::bigint));`,
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
      `alter table "user_api_key" drop constraint "user_api_key_user_id_foreign";`,
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
    this.addSql(
      `alter table "workspace_api_key" drop constraint "workspace_api_key_workspace_id_foreign";`,
    );

    this.addSql(`drop table if exists "user" cascade;`);
    this.addSql(`drop table if exists "session" cascade;`);
    this.addSql(`drop table if exists "account" cascade;`);
    this.addSql(`drop table if exists "user_api_key" cascade;`);
    this.addSql(`drop table if exists "verification" cascade;`);
    this.addSql(`drop table if exists "workspace" cascade;`);
    this.addSql(`drop table if exists "member" cascade;`);
    this.addSql(`drop table if exists "invitation" cascade;`);
    this.addSql(`drop table if exists "workspace_api_key" cascade;`);
  }
}
