import type { MigrationDiff } from ".";
import * as rowLevelSecurity from ".";
import * as rowLevelSecurityUtils from "./utils";

describe("row level security package exports", () => {
  it("exports the public package API", () => {
    expect(rowLevelSecurity.Policy).toBeDefined();
    expect(rowLevelSecurity.PolicyCommand.SELECT).toBe("select");
    expect(rowLevelSecurity.PolicyMode.PERMISSIVE).toBe("permissive");
    expect(rowLevelSecurity.RowLevelSecurityContext).toBeDefined();
    expect(rowLevelSecurity.RowLevelSecurityEntityManager).toBeDefined();
    expect(rowLevelSecurity.RowLevelSecurityMigration).toBeDefined();
    expect(rowLevelSecurity.RowLevelSecurityMigrationGenerator).toBeDefined();
    expect(rowLevelSecurity.createPolicyUpSqlStatements).toBeDefined();
  });

  it("exports utility helpers", () => {
    expect(rowLevelSecurityUtils.assertIdentifier("valid_identifier")).toBe(
      "valid_identifier",
    );
    expect(rowLevelSecurityUtils.DEFAULT_ROW_LEVEL_SECURITY_OPTIONS).toEqual({
      anonymousRole: "anonymous",
      authenticatedRole: "authenticated",
      namespace: "app",
    });
    expect(rowLevelSecurityUtils.createPolicyBootstrapSqlStatements()).toEqual(
      expect.arrayContaining(["create schema if not exists app;"]),
    );
  });

  it("exports migration generator types", () => {
    const diff: MigrationDiff = { down: [], up: [] };

    expect(diff).toEqual({ down: [], up: [] });
  });
});
