import { describe, expect, it } from "vitest";

import {
  DEFAULT_USER_ADMIN_ROLES,
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLE,
  DEFAULT_USER_ROLES,
} from "./user.constants.js";

describe("DEFAULT_USER_ROLES", () => {
  it("declares default and administrative role names", () => {
    expect(DEFAULT_USER_ROLE).toBe("user");
    expect(DEFAULT_USER_ADMIN_ROLES).toEqual(["admin"]);
  });

  it("declares the complete default user permission catalog", () => {
    expect(DEFAULT_USER_PERMISSIONS).toContain("user:set-roles");
    expect(DEFAULT_USER_PERMISSIONS).toContain("session:revoke");
  });

  it("grants administration to admins and explicit workspace creation to users", () => {
    expect(DEFAULT_USER_ROLES).toEqual({
      admin: [
        "user:create",
        "user:read",
        "user:set-roles",
        "user:set-permissions",
        "user:ban",
        "user:impersonate",
        "user:impersonate-admin",
        "user:delete",
        "user:set-password",
        "user:set-email",
        "user:update",
        "session:read",
        "session:revoke",
        "user-api-key:read",
        "user-api-key:write",
        "workspace:create",
      ],
      user: ["workspace:create"],
    });
  });
});
