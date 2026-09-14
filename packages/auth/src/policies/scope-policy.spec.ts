import type { PolicyCallback, PolicyDef } from "@mikro-orm/core";

import { userScopePolicy } from "./user-scope.policy.js";
import { workspaceScopePolicy } from "./workspace-scope.policy.js";

function resolve(value: PolicyDef["using"], columns: Record<string, string>) {
  return (value as PolicyCallback<Record<string, unknown>>)(
    columns as never,
    {} as never,
  );
}

describe.each([
  { scope: "user", create: userScopePolicy },
  { scope: "workspace", create: workspaceScopePolicy },
])("$scope scope policy", ({ scope, create }) => {
  it("defaults to bigint, the scope property, ALL, and authenticated", () => {
    const policy = create();
    expect(policy).toEqual({
      command: "all",
      roles: ["authenticated"],
      using: expect.any(Function),
      check: expect.any(Function),
    });
    expect(resolve(policy.using, { [scope]: "owner_ref" })).toBe(
      `"owner_ref" = nullif(current_setting('app.${scope}', true), '')::bigint`,
    );
    expect(policy.using).toBe(policy.check);
  });

  it.each(["all", "select", "insert", "update", "delete"] as const)(
    "generates only valid clauses for %s",
    (command) => {
      const policy = create({ command });
      expect(policy.command).toBe(command);
      expect(policy.using !== undefined).toBe(command !== "insert");
      expect(policy.check !== undefined).toBe(
        ["all", "insert", "update"].includes(command),
      );
    },
  );

  it.each(["bigint", "integer", "uuid", "text"] as const)(
    "supports an explicit %s cast and custom property",
    (type) => {
      const policy = create({
        type,
        property: "owner",
        roles: ["reader"],
        name: "owner_access",
      });
      expect(policy.name).toBe("owner_access");
      expect(policy.roles).toEqual(["reader"]);
      expect(resolve(policy.using, { owner: 'Owner"ID' })).toBe(
        `"Owner""ID" = nullif(current_setting('app.${scope}', true), '')::${type}`,
      );
    },
  );

  it("rejects invalid configuration and unmapped properties", () => {
    expect(() => create({ type: "bigint);--" } as never)).toThrow(/type/i);
    expect(() => create({ command: "invalid" } as never)).toThrow(/command/i);
    expect(() => create({ property: "" })).toThrow(/property/i);
    expect(() => create({ roles: [] })).toThrow(/roles/i);
    expect(() => resolve(create().using, {})).toThrow(/mapped column/i);
    expect(() =>
      resolve(create({ property: "constructor" }).using, {}),
    ).toThrow(/mapped column/i);
  });

  it("isolates generated policies and copies supplied roles", () => {
    const roles = ["reader"];
    const options = { roles };
    const policy = create(options);
    roles.push("writer");
    options.roles = ["new_role"];
    expect(policy.roles).toEqual(["reader"]);
    expect(create()).not.toBe(create());
  });
});
