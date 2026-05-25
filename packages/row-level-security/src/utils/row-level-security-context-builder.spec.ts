import { RowLevelSecurityContextBuilder } from "./row-level-security-context-builder";

describe("RowLevelSecurityContextBuilder", () => {
  it("generates transaction-local tenant context SQL", () => {
    const builder = new RowLevelSecurityContextBuilder();

    builder.set("request_id", "1");
    builder.set("tenant_id", "42");

    expect(builder.entries()).toEqual([
      ["request_id", "1"],
      ["tenant_id", "42"],
    ]);
    expect(builder.toSQL()).toBe(
      "SELECT set_config('app.request_id', '1', true),set_config('app.tenant_id', '42', true);",
    );
  });

  it("ignores null and undefined values", () => {
    const builder = new RowLevelSecurityContextBuilder();

    builder.set("request_id", undefined);
    builder.set("tenant_id", null);
    builder.set("is_enabled", false);

    expect(builder.entries()).toEqual([["is_enabled", "false"]]);
    expect(builder.toSQL()).toBe(
      "SELECT set_config('app.is_enabled', 'false', true);",
    );
  });

  it("renders no-op SQL when every value is nullish", () => {
    const builder = new RowLevelSecurityContextBuilder();

    builder.set("request_id", undefined);
    builder.set("tenant_id", null);

    expect(builder.entries()).toEqual([]);
    expect(builder.toSQL()).toBe("SELECT 1;");
  });

  it("escapes string values for SQL literals", () => {
    const builder = new RowLevelSecurityContextBuilder();

    builder.set("user_name", "O'Connor");

    expect(builder.toSQL()).toBe(
      "SELECT set_config('app.user_name', 'O''Connor', true);",
    );
  });

  it("rejects non snake_case context keys", () => {
    const builder = new RowLevelSecurityContextBuilder();

    expect(() => builder.set("userId" as never, "1")).toThrow(
      "Row level security context key must be snake_case",
    );
  });
});
