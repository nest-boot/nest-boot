import {
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLES,
} from "../user.constants.js";
import { resolveAuthCatalog } from "./resolve-auth-catalog.util.js";

describe("additive auth configuration", () => {
  it("reuses deeply immutable catalogs without leaking between configurations or scopes", () => {
    const configured = {
      permissions: ["article:read"],
      roles: { editor: ["article:read"] },
    };
    const first = resolveAuthCatalog({ user: configured }, "user");
    expect(resolveAuthCatalog({ user: configured }, "user")).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.permissions)).toBe(true);
    expect(Object.isFrozen(first.roles)).toBe(true);
    expect(Object.isFrozen(first.roles.editor)).toBe(true);
    expect(resolveAuthCatalog({ workspace: configured }, "workspace")).not.toBe(
      first,
    );
    expect(
      resolveAuthCatalog({ user: { permissions: ["other:read"] } }, "user")
        .permissions,
    ).not.toContain("article:read");
    configured.roles.editor.push("article:write");
    expect(first.roles.editor).toEqual(["article:read"]);
  });
  it("extends permission catalogs and same-name roles while preserving built-in roles", () => {
    const options = {
      user: {
        permissions: ["article:read", "user:get"],
        roles: { admin: ["article:read"], editor: ["article:read"] },
      },
    };
    const result = resolveAuthCatalog(options, "user");
    expect(result.permissions).toEqual([
      ...DEFAULT_USER_PERMISSIONS,
      "article:read",
    ]);
    expect(result.roles).toEqual({
      ...DEFAULT_USER_ROLES,
      admin: [...DEFAULT_USER_ROLES.admin, "article:read"],
      editor: ["article:read"],
    });
    expect(options.user.roles.admin).toEqual(["article:read"]);
    expect(options.user.permissions).toEqual(["article:read", "user:get"]);
  });

  it.each(["user", "workspace"] as const)(
    "treats empty %s additions as unchanged defaults and never automatically grants custom permissions",
    (scope) => {
      expect(
        resolveAuthCatalog({ [scope]: { permissions: [], roles: {} } }, scope),
      ).toEqual(resolveAuthCatalog({}, scope));
      const result = resolveAuthCatalog(
        { [scope]: { permissions: ["article:read"] } },
        scope,
      );
      for (const permissions of Object.values(result.roles)) {
        expect(permissions).not.toContain("article:read");
      }
    },
  );
});
