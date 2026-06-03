import { PolicyCommand } from "../enums/policy-command.enum";
import { PolicyMode } from "../enums/policy-mode.enum";
import { createPolicyBootstrapSqlStatements } from "./create-policy-bootstrap-sql-statements";
import { createPolicyDownSql } from "./create-policy-down-sql";
import { createPolicyPrivilegeDownSqlStatements } from "./create-policy-privilege-down-sql-statements";
import {
  createPolicyRoleDownSqlStatements,
  createPolicyRoleUpSqlStatements,
  getPolicyRoleNames,
} from "./create-policy-role-sql-statements";
import { createPolicyUpSqlStatements } from "./create-policy-up-sql-statements";

describe("policy migration SQL", () => {
  it("generates row level security bootstrap SQL", () => {
    const statements = createPolicyBootstrapSqlStatements();

    expect(statements).toEqual([]);
    expect(statements.join("\n")).not.toContain("grant all on all tables");
    expect(statements.join("\n")).not.toContain("get_context");
  });

  it("does not generate role bootstrap SQL for anonymous and custom policy roles", () => {
    const statements = createPolicyRoleUpSqlStatements([
      "authenticated",
      "workspace_admin",
    ]);

    expect(statements).toEqual([]);
    expect(statements.join("\n")).not.toContain("create role");
    expect(statements.join("\n")).not.toContain("current_user");
    expect(statements.join("\n")).not.toContain("grant usage on schema app");
  });

  it("does not generate role down SQL", () => {
    const statements = createPolicyRoleDownSqlStatements(["workspace_admin"]);

    expect(statements).toEqual([]);
    expect(createPolicyRoleDownSqlStatements()).toEqual([]);
    expect(statements.join("\n")).not.toContain("drop role");
    expect(statements.join("\n")).not.toContain("current_user");
    expect(statements.join("\n")).not.toContain("revoke usage on schema app");
  });

  it("generates role down SQL for an explicit anonymous role", () => {
    const statements = createPolicyRoleDownSqlStatements(["anonymous"]);

    expect(statements).toEqual([]);
  });

  it("normalizes policy role names with anonymous first and public skipped", () => {
    expect(getPolicyRoleNames()).toEqual(["anonymous"]);
    expect(
      getPolicyRoleNames([
        "workspace_admin",
        "public",
        "authenticated",
        "workspace_admin",
      ]),
    ).toEqual(["anonymous", "authenticated", "workspace_admin"]);
  });

  it("generates policy up SQL", () => {
    const statements = createPolicyUpSqlStatements({
      schemaName: "public",
      tableName: "workspace_member",
      policyName: "workspace_member_user_select_policy",
      command: PolicyCommand.SELECT,
      using: `((select current_setting('app.user_id', true)::bigint) = "user_id")`,
    });

    expect(statements).toEqual([
      'alter table "public"."workspace_member" enable row level security;',
      'drop policy if exists workspace_member_user_select_policy on "public"."workspace_member";',
      'create policy workspace_member_user_select_policy on "public"."workspace_member" as permissive for select using ((select current_setting(\'app.user_id\', true)::bigint) = "user_id");',
    ]);
  });

  it("generates policy SQL for explicit roles", () => {
    const statements = createPolicyUpSqlStatements({
      schemaName: "public",
      tableName: "workspace_member",
      policyName: "workspace_member_user_select_policy",
      command: PolicyCommand.SELECT,
      using: `((select current_setting('app.user_id', true)::bigint) = "user_id")`,
      roles: ["authenticated", "anonymous"],
    });

    expect(statements[2]).toBe(
      'drop policy if exists workspace_member_user_select_policy on "public"."workspace_member";',
    );
  });

  it("wraps raw using predicates in parentheses", () => {
    const statements = createPolicyUpSqlStatements({
      schemaName: "public",
      tableName: "user",
      policyName: "user_select_authenticated_policy",
      command: PolicyCommand.SELECT,
      using: "true",
      roles: ["authenticated"],
    });

    expect(statements).toContain(
      'create policy user_select_authenticated_policy on "public"."user" as permissive for select to authenticated using (true);',
    );
  });

  it("generates table grants for explicit policy roles", () => {
    const statements = createPolicyUpSqlStatements({
      schemaName: "public",
      tableName: "workspace_member",
      policyName: "workspace_member_user_select_policy",
      command: PolicyCommand.SELECT,
      using: `((select current_setting('app.user_id', true)::bigint) = "user_id")`,
      roles: ["authenticated", "anonymous"],
    });

    expect(statements).toEqual([
      'alter table "public"."workspace_member" enable row level security;',
      'grant select on table "public"."workspace_member" to authenticated, anonymous;',
      'drop policy if exists workspace_member_user_select_policy on "public"."workspace_member";',
      'create policy workspace_member_user_select_policy on "public"."workspace_member" as permissive for select to authenticated, anonymous using ((select current_setting(\'app.user_id\', true)::bigint) = "user_id");',
    ]);
  });

  it("generates sequence grants for explicit insert policy roles", () => {
    const statements = createPolicyUpSqlStatements({
      schemaName: "public",
      tableName: "workspace_member",
      policyName: "workspace_member_insert_policy",
      command: PolicyCommand.INSERT,
      withCheck: "true",
      roles: ["authenticated"],
    });

    expect(statements).toContain(
      'grant insert on table "public"."workspace_member" to authenticated;',
    );
    expect(statements).toEqual(
      expect.arrayContaining([
        expect.stringContaining("pg_get_serial_sequence"),
        expect.stringContaining(
          "grant usage, select on sequence %s to authenticated",
        ),
      ]),
    );
  });

  it.each([
    [PolicyCommand.SELECT, "revoke select on table"],
    [PolicyCommand.INSERT, "revoke insert on table"],
    [PolicyCommand.UPDATE, "revoke select, update on table"],
    [PolicyCommand.DELETE, "revoke select, delete on table"],
    [PolicyCommand.ALL, "revoke select, insert, update, delete on table"],
  ])("generates policy privilege revoke SQL for %s", (command, expected) => {
    const statements = createPolicyPrivilegeDownSqlStatements({
      schemaName: "public",
      tableName: "workspace_member",
      policyName: "workspace_member_policy",
      command,
      roles: ["authenticated"],
    });

    expect(statements[0]).toContain(expected);

    if (command === PolicyCommand.INSERT || command === PolicyCommand.ALL) {
      expect(statements).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "revoke usage, select on sequence %s from authenticated",
          ),
        ]),
      );
    } else {
      expect(statements).toHaveLength(1);
    }
  });

  it("does not generate policy privilege revoke SQL without explicit roles", () => {
    expect(
      createPolicyPrivilegeDownSqlStatements({
        schemaName: "public",
        tableName: "workspace_member",
        policyName: "workspace_member_policy",
      }),
    ).toEqual([]);
  });

  it("defaults policy privilege revoke SQL to all command privileges", () => {
    expect(
      createPolicyPrivilegeDownSqlStatements({
        schemaName: "public",
        tableName: "workspace_member",
        policyName: "workspace_member_policy",
        roles: ["authenticated"],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'revoke select, insert, update, delete on table "public"."workspace_member" from authenticated;',
        ),
        expect.stringContaining(
          "revoke usage, select on sequence %s from authenticated",
        ),
      ]),
    );
  });

  it("keeps policy privilege grants required by preserved policies", () => {
    const statements = createPolicyPrivilegeDownSqlStatements(
      {
        schemaName: "public",
        tableName: "workspace_member",
        policyName: "workspace_member_all_policy",
        command: PolicyCommand.ALL,
        roles: ["authenticated", "workspace_admin"],
      },
      [
        {
          schemaName: "public",
          tableName: "workspace_member",
          policyName: "workspace_member_insert_policy",
          command: PolicyCommand.INSERT,
          withCheck: "true",
          roles: ["authenticated"],
        },
      ],
    );

    expect(statements).toEqual(
      expect.arrayContaining([
        'revoke select, update, delete on table "public"."workspace_member" from authenticated;',
        'revoke select, insert, update, delete on table "public"."workspace_member" from workspace_admin;',
      ]),
    );
    expect(statements).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "revoke usage, select on sequence %s from workspace_admin",
        ),
      ]),
    );
    expect(statements).toEqual(
      expect.not.arrayContaining([
        expect.stringContaining(
          "revoke usage, select on sequence %s from authenticated",
        ),
      ]),
    );
  });

  it("generates restrictive policy SQL", () => {
    const statements = createPolicyUpSqlStatements({
      schemaName: "public",
      tableName: "workspace_member",
      policyName: "tenant_required_policy",
      mode: PolicyMode.RESTRICTIVE,
      using: `((select current_setting('app.tenant_id', true)::bigint) is not null)`,
    });

    expect(statements[2]).toBe(
      'create policy tenant_required_policy on "public"."workspace_member" as restrictive for all using ((select current_setting(\'app.tenant_id\', true)::bigint) is not null);',
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
      'create policy workspace_member_insert_policy on "public"."workspace_member" as permissive for insert with check (true);',
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
