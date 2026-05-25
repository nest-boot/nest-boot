import { PolicyCommand } from "../enums/policy-command.enum";
import { PolicyMode } from "../enums/policy-mode.enum";
import { createPolicyBootstrapSqlStatements } from "./create-policy-bootstrap-sql-statements";
import { createPolicyDownSql } from "./create-policy-down-sql";
import { createPolicyUpSqlStatements } from "./create-policy-up-sql-statements";

describe("policy migration SQL", () => {
  it("generates row level security bootstrap SQL", () => {
    const statements = createPolicyBootstrapSqlStatements();

    expect(statements).toEqual([
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
    ]);
    expect(statements.join("\n")).not.toContain("get_policy_context");
  });

  it("generates policy up SQL", () => {
    const statements = createPolicyUpSqlStatements({
      schemaName: "public",
      tableName: "workspace_member",
      policyName: "workspace_member_user_select_policy",
      command: PolicyCommand.SELECT,
      using: `((select app.get_context('user_id', null::bigint)) = "user_id")`,
    });

    expect(statements).toEqual([
      'alter table "public"."workspace_member" enable row level security;',
      'drop policy if exists workspace_member_user_select_policy on "public"."workspace_member";',
      'create policy workspace_member_user_select_policy on "public"."workspace_member" as permissive for select using ((select app.get_context(\'user_id\', null::bigint)) = "user_id");',
    ]);
  });

  it("generates policy SQL for explicit roles", () => {
    const statements = createPolicyUpSqlStatements({
      schemaName: "public",
      tableName: "workspace_member",
      policyName: "workspace_member_user_select_policy",
      command: PolicyCommand.SELECT,
      using: `((select app.get_context('user_id', null::bigint)) = "user_id")`,
      roles: ["authenticated", "anonymous"],
    });

    expect(statements[2]).toBe(
      'create policy workspace_member_user_select_policy on "public"."workspace_member" as permissive for select to authenticated, anonymous using ((select app.get_context(\'user_id\', null::bigint)) = "user_id");',
    );
  });

  it("generates restrictive policy SQL", () => {
    const statements = createPolicyUpSqlStatements({
      schemaName: "public",
      tableName: "workspace_member",
      policyName: "tenant_required_policy",
      mode: PolicyMode.RESTRICTIVE,
      using: `((select app.get_context('tenant_id', null::bigint)) is not null)`,
    });

    expect(statements[2]).toBe(
      'create policy tenant_required_policy on "public"."workspace_member" as restrictive for all using ((select app.get_context(\'tenant_id\', null::bigint)) is not null);',
    );
  });

  it("generates insert policy SQL with only a with check predicate", () => {
    const statements = createPolicyUpSqlStatements({
      schemaName: "public",
      tableName: "workspace_member",
      policyName: "workspace_member_insert_policy",
      command: PolicyCommand.INSERT,
      withCheck: ` true `,
    });

    expect(statements[2]).toBe(
      'create policy workspace_member_insert_policy on "public"."workspace_member" as permissive for insert with check true;',
    );
  });

  it.each([
    [
      "select without using",
      {
        schemaName: "public",
        tableName: "workspace_member",
        policyName: "workspace_member_select_policy",
        command: PolicyCommand.SELECT,
      },
      "Policy using expression is required",
    ],
    [
      "delete with withCheck",
      {
        schemaName: "public",
        tableName: "workspace_member",
        policyName: "workspace_member_delete_policy",
        command: PolicyCommand.DELETE,
        using: "true",
        withCheck: "true",
      },
      "Policy withCheck is not allowed for delete",
    ],
    [
      "insert with using",
      {
        schemaName: "public",
        tableName: "workspace_member",
        policyName: "workspace_member_insert_policy",
        command: PolicyCommand.INSERT,
        using: "true",
        withCheck: "true",
      },
      "Policy using is not allowed for insert",
    ],
    [
      "insert without withCheck",
      {
        schemaName: "public",
        tableName: "workspace_member",
        policyName: "workspace_member_insert_policy",
        command: PolicyCommand.INSERT,
      },
      "Policy withCheck expression is required",
    ],
    [
      "all without predicates",
      {
        schemaName: "public",
        tableName: "workspace_member",
        policyName: "workspace_member_all_policy",
      },
      "Policy using or withCheck expression is required",
    ],
  ])("rejects %s", (_name, options, message) => {
    expect(() => createPolicyUpSqlStatements(options)).toThrow(message);
  });

  it("generates guarded policy down SQL", () => {
    const sql = createPolicyDownSql({
      schemaName: "public",
      tableName: "workspace_member",
      policyName: "workspace_member_user_select_policy",
    });

    expect(sql).toContain('to_regclass(\'"public"."workspace_member"\')');
    expect(sql).toContain(
      'drop policy if exists workspace_member_user_select_policy on "public"."workspace_member"',
    );
    expect(sql).toContain("disable row level security");
  });
});
