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
    const first = resolveAuthCatalog(
      { workspace: { enabled: true }, user: configured },
      "user",
    );
    expect(
      resolveAuthCatalog(
        { workspace: { enabled: true }, user: configured },
        "user",
      ),
    ).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.permissions)).toBe(true);
    expect(Object.isFrozen(first.roles)).toBe(true);
    expect(Object.isFrozen(first.roles.editor)).toBe(true);
    expect(resolveAuthCatalog({ workspace: configured }, "workspace")).not.toBe(
      first,
    );
    expect(
      resolveAuthCatalog(
        { workspace: { enabled: true }, user: { permissions: ["other:read"] } },
        "user",
      ).permissions,
    ).not.toContain("article:read");
    configured.roles.editor.push("article:write");
    expect(first.roles.editor).toEqual(["article:read"]);
  });
  it("extends permission catalogs and same-name roles while preserving built-in roles", () => {
    const options = {
      workspace: { enabled: true },
      user: {
        permissions: ["article:read", "user:read"],
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
    expect(options.user.permissions).toEqual(["article:read", "user:read"]);
  });
  it.each(["user", "workspace"] as const)(
    "treats empty %s additions as unchanged defaults and never automatically grants custom permissions",
    (scope) => {
      expect(
        resolveAuthCatalog(
          {
            workspace: { enabled: true },
            [scope]: {
              ...(scope === "workspace" ? { enabled: true } : {}),
              permissions: [],
              roles: {},
            },
          },
          scope,
        ),
      ).toEqual(resolveAuthCatalog({ workspace: { enabled: true } }, scope));
      const result = resolveAuthCatalog(
        {
          workspace: { enabled: true },
          [scope]: {
            ...(scope === "workspace" ? { enabled: true } : {}),
            permissions: ["article:read"],
          },
        },
        scope,
      );
      for (const permissions of Object.values(result.roles)) {
        expect(permissions).not.toContain("article:read");
      }
    },
  );
});

describe("optional workspace behavior", () => {
  it("isolates cached user catalogs across enabled and disabled workspace configurations", () => {
    const user = { permissions: ["report:read"] };
    const disabled = resolveAuthCatalog({ user }, "user");
    const enabled = resolveAuthCatalog(
      { user, workspace: { enabled: true } },
      "user",
    );
    expect(enabled.permissions).toContain("workspace:create");
    expect(disabled.permissions).not.toContain("workspace:create");
    expect(resolveAuthCatalog({ user }, "user")).toBe(disabled);
  });
});
