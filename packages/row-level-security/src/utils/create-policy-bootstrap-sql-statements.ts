/** Creates SQL statements for the shared RLS schema and `app.get_context` helper. */
export function createPolicyBootstrapSqlStatements() {
  return [
    "create schema if not exists app;",
    "create or replace function app.get_context(context_key text, context_type anyelement) returns anyelement as $$ declare context_value text; begin context_value := current_setting('app.' || context_key, true); if context_value is null or context_value = '' then return null; end if; execute format('select $1::%s', pg_typeof(context_type)::text) using context_value into context_type; return context_type; end; $$ language plpgsql stable;",
  ];
}
