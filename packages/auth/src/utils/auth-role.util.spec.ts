import { BadRequestException } from "@nestjs/common";

import {
  assertAuthPermissionSubset,
  assertAuthRolesExist,
  normalizeAuthPermissions,
  normalizeAuthRoles,
  resolveAuthPermissions,
} from "./auth-role.util.js";

describe("assertAuthRolesExist", () => {
  it("accepts configured role names", () => {
    expect(() => {
      assertAuthRolesExist(
        { admin: [], user: [] },
        ["admin", "user"],
        "user.adminRoles",
      );
    }).not.toThrow();
  });

  it("rejects unknown configured role names", () => {
    expect(() => {
      assertAuthRolesExist({ user: [] }, ["admin"], "user.adminRoles");
    }).toThrow('user.adminRoles references unknown role "admin"');
  });

  it.each(["constructor", "toString"])(
    "rejects inherited lifecycle role %s",
    (role) => {
      expect(() => {
        assertAuthRolesExist({ user: [] }, [role], "user.adminRoles");
      }).toThrow(`user.adminRoles references unknown role "${role}"`);
    },
  );
});

describe("role assignment", () => {
  it.each(["constructor", "toString"])(
    "rejects inherited assigned role %s",
    (role) => {
      expect(() => normalizeAuthRoles([role], { user: [] })).toThrow(
        `Unknown role: ${role}`,
      );
    },
  );

  it("ignores inherited role names when resolving persisted assignments", () => {
    expect(
      resolveAuthPermissions(["toString", "user"], ["profile:update"], {
        user: ["profile:read"],
      }),
    ).toEqual(["profile:read", "profile:update"]);
  });
});

describe("normalizeAuthPermissions", () => {
  const availablePermissions = ["project:read", "project:update"];

  it("returns valid permissions without changing their order", () => {
    expect(
      normalizeAuthPermissions(
        ["project:update", "project:read"],
        availablePermissions,
        "Workspace member",
      ),
    ).toEqual(["project:update", "project:read"]);
  });

  it.each([
    [[""], "permissions must contain non-empty strings"],
    [[" project:read"], "permissions must contain non-empty strings"],
    [
      ["project:read", "project:read"],
      "contains duplicate permissions: project:read",
    ],
    [["project:delete"], "contains unknown permissions: project:delete"],
    [["Project:read"], "contains unknown permissions: Project:read"],
    [["project:READ"], "contains unknown permissions: project:READ"],
  ] as const)("rejects invalid permission input %#", (permissions, message) => {
    expect(() =>
      normalizeAuthPermissions(
        permissions,
        availablePermissions,
        "Workspace member",
      ),
    ).toThrow(new BadRequestException(`Workspace member ${message}`));
  });

  it("preserves arbitrary configured identifiers and distinguishes case variants", () => {
    const permissions = [
      "User:read",
      "user:read",
      "user:READ",
      "EXPORT",
      "项目/读取",
    ];
    expect(normalizeAuthPermissions(permissions, permissions, "User")).toEqual(
      permissions,
    );
    expect(
      resolveAuthPermissions(["Admin"], ["user:READ", "User:read"], {
        Admin: ["User:read", "user:read"],
      }),
    ).toEqual(["User:read", "user:read", "user:READ"]);
  });

  it("compares permission ceilings by exact strings", () => {
    expect(() => {
      assertAuthPermissionSubset(["User:read"], ["User:read"], "API key");
    }).not.toThrow();
    expect(() => {
      assertAuthPermissionSubset(["User:read"], ["user:read"], "API key");
    }).toThrow(
      "contains permissions outside apiKey.allowedPermissions: User:read",
    );
  });
});
