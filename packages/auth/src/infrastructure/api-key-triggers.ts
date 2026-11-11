import type { TriggerDef } from "@mikro-orm/core";

/**
 * Quotes a PostgreSQL identifier used in generated trigger DDL.
 * @param identifier - Schema or relation identifier.
 * @returns Safely quoted identifier.
 */
function quote(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

/**
 * Defines a database trigger and a restricted, schema-qualified trigger function.
 * Raw DDL is required because TriggerDef does not expose SECURITY DEFINER.
 * @param table - Table receiving the trigger.
 * @param name - Trigger name.
 * @param events - Trigger events.
 * @param body - Trusted function body.
 * @param schema - Schema containing the table and function.
 * @returns Trigger metadata managed by MikroORM schema generation and migrations.
 */
function trigger(
  table: string,
  name: string,
  events: ("insert" | "update" | "delete")[],
  body: string,
  schema: string,
): TriggerDef {
  const target = `${quote(schema)}.${quote(table)}`;
  const eventNames = events
    .map((event) => `'${event.toUpperCase()}'`)
    .join(", ");
  const fn = `${quote(schema)}.${quote(`${table}_${name}_fn`)}`;
  return {
    name,
    timing: "after",
    events,
    expression: `create or replace function ${fn}() returns trigger language plpgsql security definer set search_path = pg_catalog as $$ begin
      if TG_RELID <> ${"'" + target.replaceAll("'", "''") + "'"}::regclass or TG_NAME <> '${name.replaceAll("'", "''")}' or TG_OP not in (${eventNames}) or TG_WHEN <> 'AFTER' or TG_LEVEL <> 'ROW' then raise exception 'Unexpected API-key trigger target'; end if;
      ${body}
    end; $$;
    revoke all on function ${fn}() from public;
    create trigger ${quote(name)} after ${events.join(" or ")} on ${target} for each row execute function ${fn}();`,
  };
}

/**
 * Cleans polymorphic keys even when their owner is deleted by SQL or an FK cascade.
 * @param owner - Concrete owner table and discriminator.
 * @param schema - PostgreSQL schema containing the authentication tables.
 * @returns Owner deletion trigger.
 */
export function apiKeyCleanupTrigger(
  owner: "user" | "member" | "system_account",
  schema: string,
): TriggerDef {
  return trigger(
    owner,
    `${owner}_api_key_cleanup`,
    ["delete"],
    `delete from ${quote(schema)}."api_key" where "owner_type" = '${owner}' and "owner_id" = OLD."id"; return OLD;`,
    schema,
  );
}

/**
 * Rejects dangling owners and serializes insertion with concurrent owner deletion.
 * @param workspace - Whether member owners are registered.
 * @param schema - PostgreSQL schema containing the authentication tables.
 * @returns Owner integrity trigger.
 */
export function apiKeyOwnerTrigger(
  workspace: boolean,
  schema: string,
): TriggerDef {
  const member = workspace
    ? `elsif NEW."owner_type" = 'member' then perform 1 from ${quote(schema)}."member" where "id" = NEW."owner_id" for key share;`
    : "";
  return trigger(
    "api_key",
    "api_key_owner_exists",
    ["insert", "update"],
    `
    if TG_OP = 'UPDATE' then
      if NEW."owner_type" is not distinct from OLD."owner_type" and NEW."owner_id" is not distinct from OLD."owner_id" then return NEW; end if;
    end if;
    if NEW."owner_type" = 'user' then perform 1 from ${quote(schema)}."user" where "id" = NEW."owner_id" for key share;
    elsif NEW."owner_type" = 'system_account' then perform 1 from ${quote(schema)}."system_account" where "id" = NEW."owner_id" for key share;
    ${member}
    else raise exception 'Invalid API-key owner type' using errcode = '23514'; end if;
    if not found then raise exception 'API-key owner does not exist' using errcode = '23503'; end if;
    return NEW;`,
    schema,
  );
}
