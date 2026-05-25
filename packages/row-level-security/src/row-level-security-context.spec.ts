import { RequestContext } from "@nest-boot/request-context";

import { RowLevelSecurityContext } from "./row-level-security-context";

describe("RowLevelSecurityContext", () => {
  it("stores the database role in RequestContext", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RowLevelSecurityContext.setRole("authenticated");

      expect(RowLevelSecurityContext.getRole()).toBe("authenticated");
    });
  });

  it("stores policy context values in RequestContext", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RowLevelSecurityContext.set("tenant_id", "42");
      RowLevelSecurityContext.set("user_id", 7);

      expect(RowLevelSecurityContext.get("tenant_id")).toBe("42");
      expect(RowLevelSecurityContext.entries()).toEqual([
        ["tenant_id", "42"],
        ["user_id", 7],
      ]);
    });
  });

  it("returns empty values when RequestContext is inactive", () => {
    expect(RowLevelSecurityContext.getRole()).toBeUndefined();
    expect(RowLevelSecurityContext.get("tenant_id")).toBeUndefined();
    expect(RowLevelSecurityContext.entries()).toEqual([]);
  });
});
