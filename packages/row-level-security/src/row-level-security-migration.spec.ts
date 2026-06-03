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
      using: `((select current_setting('app.user_id', true)::bigint) = "user_id")`,
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

    expect(queries.join("\n")).not.toContain("create schema if not exists app");
    expect(queries.join("\n")).not.toContain("grant usage on schema app");
    expect(queries.join("\n")).not.toContain("create role anonymous");
    expect(queries.join("\n")).not.toContain("grant anonymous to current_user");
    expect(queries.join("\n")).not.toContain("app.get_context");
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
