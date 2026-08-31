import { RequestContext } from "@nest-boot/request-context";

import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "./row-level-security.js";

describe("RowLevelSecurity", () => {
  it("stores the database role in RequestContext", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RowLevelSecurity.setRole("authenticated");

      expect(RowLevelSecurity.getRole()).toBe("authenticated");
    });
  });

  it("stores policy context values in RequestContext", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RowLevelSecurity.setContext("tenant_id", "42");
      RowLevelSecurity.setContext("user_id", 7);

      expect(RowLevelSecurity.getContext("tenant_id")).toBe("42");
      expect(RowLevelSecurity.entries()).toEqual([
        ["tenant_id", "42"],
        ["user_id", 7],
      ]);
    });
  });

  it("defaults to auto mode and stores mode in RequestContext", async () => {
    expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.AUTO);

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.AUTO);

      RowLevelSecurity.setMode(RowLevelSecurityMode.DISABLED);
      expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.DISABLED);

      RowLevelSecurity.setMode(RowLevelSecurityMode.ENABLED);
      expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.ENABLED);
    });
  });

  it("clears mode, role, and context values", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RowLevelSecurity.setMode(RowLevelSecurityMode.ENABLED);
      RowLevelSecurity.setRole("authenticated");
      RowLevelSecurity.setContext("tenant_id", "42");

      RowLevelSecurity.clear();

      expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.AUTO);
      expect(RowLevelSecurity.getRole()).toBeUndefined();
      expect(RowLevelSecurity.getContext("tenant_id")).toBeUndefined();
      expect(RowLevelSecurity.entries()).toEqual([]);
    });
  });

  it("returns empty values when RequestContext is inactive", () => {
    expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.AUTO);
    expect(RowLevelSecurity.getRole()).toBeUndefined();
    expect(RowLevelSecurity.getContext("tenant_id")).toBeUndefined();
    expect(RowLevelSecurity.entries()).toEqual([]);
  });
});
