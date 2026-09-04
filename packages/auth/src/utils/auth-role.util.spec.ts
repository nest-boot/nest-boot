import { BadRequestException } from "@nestjs/common";

import {
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
  ] as const)("rejects invalid permission input %#", (permissions, message) => {
    expect(() =>
      normalizeAuthPermissions(
        permissions,
        availablePermissions,
        "Workspace member",
      ),
    ).toThrow(new BadRequestException(`Workspace member ${message}`));
  });
});
