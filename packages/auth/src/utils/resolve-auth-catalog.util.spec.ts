import {
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLES,
} from "../user.constants.js";
import { resolveAuthCatalog } from "./resolve-auth-catalog.util.js";

describe("additive auth configuration", () => {
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
