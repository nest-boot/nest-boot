import { Migration } from '@mikro-orm/migrations';

/** Initializes shared database infrastructure before entity migrations. */
export class Migration00000000000000_Initial extends Migration {
  override name = 'Migration00000000000000_Initial';

  override up(): void {
    // Install extensions in a dedicated schema.
    this.addSql('create schema if not exists extensions;');
    this.addSql(
      'create extension if not exists "uuid-ossp" with schema extensions;',
    );
    this.addSql(
      'create extension if not exists pgcrypto with schema extensions;',
    );

    // Create shared request roles without changing existing roles.
    this.addSql(
      "do $$ begin if not exists (select 1 from pg_roles where rolname = 'anonymous') then create role anonymous nologin noinherit; end if; end $$;",
    );
    this.addSql(
      "do $$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if; end $$;",
    );

    // Allow the migration role to switch to request roles.
    this.addSql('grant anonymous, authenticated to current_user;');

    // Allow access to the application schema.
    this.addSql('grant usage on schema public to anonymous, authenticated;');

    // Grant access to future public objects created by the migration role.
    // TRUNCATE and sequence operations bypass RLS; do not expose arbitrary SQL.
    // Review SECURITY DEFINER functions separately for privilege escalation.
    this.addSql(
      'alter default privileges in schema public grant all on tables to anonymous, authenticated;',
    );
    this.addSql(
      'alter default privileges in schema public grant all on functions to anonymous, authenticated;',
    );
    this.addSql(
      'alter default privileges in schema public grant all on sequences to anonymous, authenticated;',
    );

    // Allow access to extension functions.
    this.addSql(
      'grant usage on schema extensions to anonymous, authenticated;',
    );
  }

  override down(): void {
    // Preserve shared infrastructure on rollback.
  }
}
