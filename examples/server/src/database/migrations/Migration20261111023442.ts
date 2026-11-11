import { Migration } from '@mikro-orm/migrations';

export class Migration20261111023442 extends Migration {
  override name = 'Migration20261111023442';

  override up(): void | Promise<void> {
    // Keep the old tables locked until both copies and all schema changes commit.
    this.addSql(
      'lock table "user_api_key", "member_api_key" in access exclusive mode;',
    );
    this.addSql(`do $$ begin
      if exists (select 1 from "user_api_key" u join "member_api_key" m on m."id" = u."id") then
        raise exception 'API-key IDs conflict across legacy tables; resolve the collision before retrying';
      end if;
      if exists (select 1 from "user_api_key" u join "member_api_key" m on m."key" = u."key") then
        raise exception 'API-key hashes conflict across legacy tables; revoke the ambiguous credentials before retrying';
      end if;
    end; $$;`);

    this.addSql(
      `create table "system_account" ("id" bigserial primary key, "name" varchar(255) not null, "enabled" boolean not null default true, "permissions" text[] not null default '{}', "created_by_id" bigint null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now());`,
    );
    this.addSql(
      `create index "system_account_created_at_index" on "system_account" ("created_at");`,
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

    this
      .addSql(`create or replace function "public"."user_user_api_key_cleanup_fn"() returns trigger language plpgsql security definer set search_path = pg_catalog as $$ begin
      if TG_RELID <> '"public"."user"'::regclass or TG_NAME <> 'user_api_key_cleanup' or TG_OP not in ('DELETE') or TG_WHEN <> 'AFTER' or TG_LEVEL <> 'ROW' then raise exception 'Unexpected API-key trigger target'; end if;       delete from "public"."api_key" where "owner_type" = 'user' and "owner_id" = OLD."id"; return OLD;     end; $$;`);
    this.addSql(
      `revoke all on function "public"."user_user_api_key_cleanup_fn"() from public;`,
    );
    this.addSql(
      `create trigger "user_api_key_cleanup" after delete on "public"."user" for each row execute function "public"."user_user_api_key_cleanup_fn"();`,
    );

    this
      .addSql(`create or replace function "public"."member_member_api_key_cleanup_fn"() returns trigger language plpgsql security definer set search_path = pg_catalog as $$ begin
      if TG_RELID <> '"public"."member"'::regclass or TG_NAME <> 'member_api_key_cleanup' or TG_OP not in ('DELETE') or TG_WHEN <> 'AFTER' or TG_LEVEL <> 'ROW' then raise exception 'Unexpected API-key trigger target'; end if;       delete from "public"."api_key" where "owner_type" = 'member' and "owner_id" = OLD."id"; return OLD;     end; $$;`);
    this.addSql(
      `revoke all on function "public"."member_member_api_key_cleanup_fn"() from public;`,
    );
    this.addSql(
      `create trigger "member_api_key_cleanup" after delete on "public"."member" for each row execute function "public"."member_member_api_key_cleanup_fn"();`,
    );

    this.addSql(
      `alter table "system_account" add constraint "system_account_created_by_id_foreign" foreign key ("created_by_id") references "user" ("id") on delete set null;`,
    );
    this
      .addSql(`create or replace function "public"."system_account_system_account_api_key_cleanup_fn"() returns trigger language plpgsql security definer set search_path = pg_catalog as $$ begin
      if TG_RELID <> '"public"."system_account"'::regclass or TG_NAME <> 'system_account_api_key_cleanup' or TG_OP not in ('DELETE') or TG_WHEN <> 'AFTER' or TG_LEVEL <> 'ROW' then raise exception 'Unexpected API-key trigger target'; end if;       delete from "public"."api_key" where "owner_type" = 'system_account' and "owner_id" = OLD."id"; return OLD;     end; $$;`);
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
      `alter table "api_key" add constraint "api_key_created_by_id_foreign" foreign key ("created_by_id") references "user" ("id") on delete set null;`,
    );
    this.addSql(
      `alter table "api_key" add constraint "api_key_owner_type_check" check ("owner_type" in ('user', 'member', 'system_account'));`,
    );
    this
      .addSql(`create or replace function "public"."api_key_api_key_owner_exists_fn"() returns trigger language plpgsql security definer set search_path = pg_catalog as $$ begin
      if TG_RELID <> '"public"."api_key"'::regclass or TG_NAME <> 'api_key_owner_exists' or TG_OP not in ('INSERT', 'UPDATE') or TG_WHEN <> 'AFTER' or TG_LEVEL <> 'ROW' then raise exception 'Unexpected API-key trigger target'; end if;     if TG_OP = 'UPDATE' then       if NEW."owner_type" is not distinct from OLD."owner_type" and NEW."owner_id" is not distinct from OLD."owner_id" then return NEW; end if;     end if;     if NEW."owner_type" = 'user' then perform 1 from "public"."user" where "id" = NEW."owner_id" for key share;     elsif NEW."owner_type" = 'system_account' then perform 1 from "public"."system_account" where "id" = NEW."owner_id" for key share;     elsif NEW."owner_type" = 'member' then perform 1 from "public"."member" where "id" = NEW."owner_id" for key share;     else raise exception 'Invalid API-key owner type' using errcode = '23514'; end if;     if not found then raise exception 'API-key owner does not exist' using errcode = '23503'; end if;     return NEW;     end; $$;`);
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
      `insert into "api_key" ("id", "name", "start", "prefix", "key", "enabled", "permissions", "created_at", "updated_at", "last_used_at", "expires_at", "owner_type", "owner_id") select "id", "name", "start", "prefix", "key", "enabled", "permissions", "created_at", "updated_at", "last_used_at", "expires_at", 'user', "user_id" from "user_api_key";`,
    );
    this.addSql(
      `insert into "api_key" ("id", "name", "start", "prefix", "key", "enabled", "permissions", "created_at", "updated_at", "last_used_at", "expires_at", "owner_type", "owner_id") select "id", "name", "start", "prefix", "key", "enabled", "permissions", "created_at", "updated_at", "last_used_at", "expires_at", 'member', "member_id" from "member_api_key";`,
    );
    this.addSql(
      `select setval(pg_get_serial_sequence('api_key', 'id'), coalesce((select max("id") from "api_key"), 1), exists (select 1 from "api_key"));`,
    );
    this.addSql('drop table "member_api_key";');
    this.addSql('drop table "user_api_key";');
  }

  override down(): void | Promise<void> {
    this.addSql(
      'lock table "api_key", "system_account" in access exclusive mode;',
    );
    // The old schema cannot represent independent system identities. Refuse data loss.
    this.addSql(`do $$ begin
      if exists (select 1 from "system_account") or exists (select 1 from "api_key" where "owner_type" = 'system_account') then
        raise exception 'Delete system accounts and their keys before rolling back the unified API-key schema';
      end if;
    end; $$;`);

    this.addSql(
      `create table "member_api_key" ("id" bigserial primary key, "name" varchar(255) not null, "start" varchar(255) null, "prefix" varchar(255) null, "key" text not null, "enabled" bool not null default true, "permissions" text[] not null default '{}', "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "last_used_at" timestamptz(6) null, "expires_at" timestamptz(6) null, "member_id" int8 not null);`,
    );
    this.addSql(
      `create index "member_api_key_created_at_index" on "member_api_key" ("created_at");`,
    );
    this.addSql(
      `create index "member_api_key_key_index" on "member_api_key" ("key");`,
    );
    this.addSql(
      `alter table "member_api_key" add constraint "member_api_key_key_unique" unique ("key");`,
    );
    this.addSql(
      `create index "member_api_key_member_id_index" on "member_api_key" ("member_id");`,
    );
    this.addSql(
      `create index "member_api_key_prefix_index" on "member_api_key" ("prefix");`,
    );

    this.addSql(
      `create table "user_api_key" ("id" bigserial primary key, "name" varchar(255) not null, "start" varchar(255) null, "prefix" varchar(255) null, "key" text not null, "enabled" bool not null default true, "permissions" text[] not null default '{}', "created_at" timestamptz(6) not null default now(), "updated_at" timestamptz(6) not null default now(), "last_used_at" timestamptz(6) null, "expires_at" timestamptz(6) null, "user_id" int8 not null);`,
    );
    this.addSql(
      `create index "user_api_key_created_at_index" on "user_api_key" ("created_at");`,
    );
    this.addSql(
      `create index "user_api_key_key_index" on "user_api_key" ("key");`,
    );
    this.addSql(
      `alter table "user_api_key" add constraint "user_api_key_key_unique" unique ("key");`,
    );
    this.addSql(
      `create index "user_api_key_prefix_index" on "user_api_key" ("prefix");`,
    );
    this.addSql(
      `create index "user_api_key_user_id_index" on "user_api_key" ("user_id");`,
    );

    this.addSql(
      `insert into "user_api_key" ("id", "name", "start", "prefix", "key", "enabled", "permissions", "created_at", "updated_at", "last_used_at", "expires_at", "user_id") select "id", "name", "start", "prefix", "key", "enabled", "permissions", "created_at", "updated_at", "last_used_at", "expires_at", "owner_id" from "api_key" where "owner_type" = 'user';`,
    );
    this.addSql(
      `select setval(pg_get_serial_sequence('user_api_key', 'id'), coalesce((select max("id") from "user_api_key"), 1), exists (select 1 from "user_api_key"));`,
    );
    this.addSql(
      `insert into "member_api_key" ("id", "name", "start", "prefix", "key", "enabled", "permissions", "created_at", "updated_at", "last_used_at", "expires_at", "member_id") select "id", "name", "start", "prefix", "key", "enabled", "permissions", "created_at", "updated_at", "last_used_at", "expires_at", "owner_id" from "api_key" where "owner_type" = 'member';`,
    );
    this.addSql(
      `select setval(pg_get_serial_sequence('member_api_key', 'id'), coalesce((select max("id") from "member_api_key"), 1), exists (select 1 from "member_api_key"));`,
    );
    this.addSql(
      `drop trigger if exists "system_account_api_key_cleanup" on "system_account";`,
    );
    this.addSql(
      `drop function if exists "system_account_system_account_api_key_cleanup_fn"();`,
    );
    this.addSql(`drop table if exists "system_account" cascade;`);
    this.addSql(`drop trigger if exists "api_key_owner_exists" on "api_key";`);
    this.addSql(`drop function if exists "api_key_api_key_owner_exists_fn"();`);
    this.addSql(`drop table if exists "api_key" cascade;`);

    this.addSql(`drop trigger if exists "member_api_key_cleanup" on "member";`);
    this.addSql(
      `drop function if exists "member_member_api_key_cleanup_fn"();`,
    );

    this.addSql(`drop trigger if exists "user_api_key_cleanup" on "user";`);
    this.addSql(`drop function if exists "user_user_api_key_cleanup_fn"();`);

    this.addSql(
      `alter table "member_api_key" add constraint "member_api_key_member_id_foreign" foreign key ("member_id") references "member" ("id") on update no action on delete cascade;`,
    );
    this.addSql(`alter table "member_api_key" enable row level security;`);
    this
      .addSql(`create policy "member_api_key_all_policy" on "member_api_key" to "authenticated" using ((EXISTS ( SELECT 1
   FROM member
  WHERE ((member.id = member_api_key.member_id) AND (member.workspace_id = (NULLIF(current_setting('app.workspace.id'::text, true), ''::text))::bigint))))) with check ((EXISTS ( SELECT 1
   FROM member
  WHERE ((member.id = member_api_key.member_id) AND (member.workspace_id = (NULLIF(current_setting('app.workspace.id'::text, true), ''::text))::bigint)))));`);

    this.addSql(
      `alter table "user_api_key" add constraint "user_api_key_user_id_foreign" foreign key ("user_id") references "user" ("id") on update no action on delete cascade;`,
    );
    this.addSql(`alter table "user_api_key" enable row level security;`);
    this.addSql(
      `create policy "user_api_key_all_policy" on "user_api_key" to "authenticated" using ((user_id = (NULLIF(current_setting('app.user.id'::text, true), ''::text))::bigint)) with check ((user_id = (NULLIF(current_setting('app.user.id'::text, true), ''::text))::bigint));`,
    );
  }
}
