import type { MigrationDiff } from ".";
import * as rowLevelSecurity from ".";
import * as rowLevelSecurityUtils from "./utils";

describe("row level security package exports", () => {
  it("exports the public package API", () => {
    expect(rowLevelSecurity.Policy).toBeDefined();
    expect(rowLevelSecurity.PolicyCommand.SELECT).toBe("select");
    expect(rowLevelSecurity.PolicyMode.PERMISSIVE).toBe("permissive");
    expect(rowLevelSecurity.RowLevelSecurity).toBeDefined();
    expect(rowLevelSecurity.RowLevelSecurityMode.AUTO).toBe("auto");
    expect(rowLevelSecurity.RowLevelSecurityRole.ANONYMOUS).toBe("anonymous");
    expect(rowLevelSecurity.RowLevelSecurityConnection).toBeDefined();
    expect(rowLevelSecurity.RowLevelSecurityDriver).toBeDefined();
    expect(rowLevelSecurity.RowLevelSecurityMigration).toBeDefined();
    expect(rowLevelSecurity.RowLevelSecurityMigrationGenerator).toBeDefined();
    expect(rowLevelSecurity.createPolicyUpSqlStatements).toBeDefined();
  });

  it("does not export the removed entity manager wrapper", () => {
    expect(
      (rowLevelSecurity as Record<string, unknown>)
        .RowLevelSecurityEntityManager,
    ).toBeUndefined();
  });

  it("does not export the old row level security context helper name", () => {
    expect(
      (rowLevelSecurity as Record<string, unknown>).RowLevelSecurityContext,
    ).toBeUndefined();
  });

  it("exports utility helpers", () => {
    expect(rowLevelSecurityUtils.assertIdentifier("valid_identifier")).toBe(
      "valid_identifier",
    );
    expect(rowLevelSecurityUtils.createPolicyBootstrapSqlStatements()).toEqual(
      expect.arrayContaining(["create schema if not exists app;"]),
    );
    expect(rowLevelSecurityUtils.createPolicyRoleUpSqlStatements()).toEqual(
      expect.arrayContaining(["grant anonymous to current_user;"]),
    );
  });

  it("exports migration generator types", () => {
    const diff: MigrationDiff = { down: [], up: [] };

    expect(diff).toEqual({ down: [], up: [] });
  });
});
