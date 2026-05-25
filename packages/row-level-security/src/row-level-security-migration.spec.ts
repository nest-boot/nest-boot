import { PolicyCommand } from "./enums/policy-command.enum";
import { RowLevelSecurityMigration } from "./row-level-security-migration";

class TestRowLevelSecurityMigration extends RowLevelSecurityMigration {
  override up() {
    this.addRowLevelSecurityBootstrapSql();
    this.addPolicySql({
      schemaName: "public",
      tableName: "workspace_member",
      policyName: "workspace_member_user_select_policy",
      command: PolicyCommand.SELECT,
      using: `((select app.get_context('user_id', null::bigint)) = "user_id")`,
    });
    this.addDropPolicySql({
      schemaName: "public",
      tableName: "workspace_member",
      policyName: "workspace_member_user_select_policy",
    });
  }
}

describe("RowLevelSecurityMigration", () => {
  it("adds policy SQL through protected helpers", () => {
    const migration = new TestRowLevelSecurityMigration(
      {} as never,
      {} as never,
    );

    migration.up();

    const queries = migration.getQueries() as string[];

    expect(migration.getQueries()).toHaveLength(12);
    expect(queries[0]).toContain("create role authenticated nologin");
    expect(queries[1]).toContain("create role anonymous nologin");
    expect(queries[2]).toContain("grant authenticated to current_user");
    expect(queries[3]).toContain("grant anonymous to current_user");
    expect(queries[4]).toContain("create schema if not exists app");
    expect(queries[7]).toContain("create or replace function app.get_context");
    expect(queries[8]).toContain(
      'alter table "public"."workspace_member" enable row level security;',
    );
    expect(queries[9]).toContain(
      'drop policy if exists workspace_member_user_select_policy on "public"."workspace_member";',
    );
    expect(queries[10]).toContain(
      "create policy workspace_member_user_select_policy",
    );
    expect(queries[11]).toContain(
      "drop policy if exists workspace_member_user_select_policy",
    );
  });
});
