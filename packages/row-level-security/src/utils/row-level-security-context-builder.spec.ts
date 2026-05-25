import { RowLevelSecurityContextBuilder } from "./row-level-security-context-builder";

describe("RowLevelSecurityContextBuilder", () => {
  it("generates transaction-local tenant context SQL", () => {
    const builder = new RowLevelSecurityContextBuilder("tenant");

    builder.set("request_id", "1");
    builder.set("tenant_id", "42");

    expect(builder.entries()).toEqual([
      ["request_id", "1"],
      ["tenant_id", "42"],
    ]);
    expect(builder.toSQL()).toBe(
      "SELECT set_config('tenant.request_id', '1', true),set_config('tenant.tenant_id', '42', true);",
    );
  });

  it("ignores null and undefined values", () => {
    const builder = new RowLevelSecurityContextBuilder("tenant");

    builder.set("request_id", undefined);
    builder.set("tenant_id", null);
    builder.set("is_enabled", false);

    expect(builder.entries()).toEqual([["is_enabled", "false"]]);
    expect(builder.toSQL()).toBe(
      "SELECT set_config('tenant.is_enabled', 'false', true);",
    );
  });

  it("escapes string values for SQL literals", () => {
    const builder = new RowLevelSecurityContextBuilder("tenant");

    builder.set("user_name", "O'Connor");

    expect(builder.toSQL()).toBe(
      "SELECT set_config('tenant.user_name', 'O''Connor', true);",
    );
  });

  it("rejects non snake_case context keys", () => {
    const builder = new RowLevelSecurityContextBuilder("tenant");

    expect(() => builder.set("userId" as never, "1")).toThrow(
      "Row level security context key must be snake_case",
    );
  });

  it("rejects unsafe namespaces", () => {
    expect(
      () => new RowLevelSecurityContextBuilder("tenant.context" as never),
    ).toThrow("Row level security context namespace must be snake_case");
  });
});
