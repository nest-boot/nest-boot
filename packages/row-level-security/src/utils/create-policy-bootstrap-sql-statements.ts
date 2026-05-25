export function createPolicyBootstrapSqlStatements() {
  return [
    "do $$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if; end $$;",
    "do $$ begin if not exists (select 1 from pg_roles where rolname = 'anonymous') then create role anonymous nologin; end if; end $$;",
    "create schema if not exists app;",
    "grant usage on schema app to authenticated;",
    "grant usage on schema app to anonymous;",
    "alter default privileges in schema public grant all on tables to authenticated;",
    "alter default privileges in schema public grant all on tables to anonymous;",
    "grant all on all tables in schema public to authenticated;",
    "grant all on all tables in schema public to anonymous;",
    "create or replace function app.get_context(context_key text, context_type anyelement) returns anyelement as $$ declare context_value text; begin context_value := current_setting('app.' || context_key, true); if context_value is null or context_value = '' then return null; end if; execute format('select $1::%s', pg_typeof(context_type)::text) using context_value into context_type; return context_type; end; $$ language plpgsql stable;",
  ];
}
