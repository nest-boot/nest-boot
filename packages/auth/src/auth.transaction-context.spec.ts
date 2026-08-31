import { AuthTransactionContext } from "./auth.transaction-context.js";

describe("AuthTransactionContext", () => {
  it("should store entries and escape SQL values", () => {
    const context = new AuthTransactionContext()
      .set("user_id", "user-1")
      .set("tenant_id", "tenant's");

    expect(context.entries()).toEqual([
      ["user_id", "user-1"],
      ["tenant_id", "tenant's"],
    ]);
    expect(context.toSQL()).toBe(
      "SELECT set_config('auth.user_id', 'user-1', true),set_config('auth.tenant_id', 'tenant''s', true);",
    );
  });

  it.each(["", "_user", "user_", "user__id", "userId", "user-Id"])(
    "should reject invalid snake_case key %s",
    (key) => {
      const context = new AuthTransactionContext();

      expect(() => context.set(key as never, "value")).toThrow(
        "Key must only contain lowercase letters and underscores",
      );
    },
  );
});
