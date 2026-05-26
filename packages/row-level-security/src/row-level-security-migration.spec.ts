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

    expect(queries).toContainEqual(
      expect.stringContaining("create role anonymous nologin"),
    );
    expect(queries).toContainEqual(
      expect.stringContaining("grant anonymous to current_user"),
    );
    expect(queries).toContainEqual(
      expect.stringContaining("create schema if not exists app"),
    );
    expect(queries).toContainEqual(
      expect.stringContaining("create or replace function app.get_context"),
    );
    expect(queries).toContainEqual(
      'alter table "public"."workspace_member" enable row level security;',
    );
    expect(queries).toContainEqual(
      'drop policy if exists workspace_member_user_select_policy on "public"."workspace_member";',
    );
    expect(queries).toContainEqual(
      expect.stringContaining(
        "create policy workspace_member_user_select_policy",
      ),
    );
  });
});
