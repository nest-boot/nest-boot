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
    expect(DEFAULT_USER_PERMISSIONS).toContain("User:set-role");
    expect(DEFAULT_USER_PERMISSIONS).toContain("Session:revoke");
  });

  it("grants the standard admin permissions and no permissions to users", () => {
    expect(DEFAULT_USER_ROLES).toEqual({
      admin: [
        "User:create",
        "User:list",
        "User:set-role",
        "User:ban",
        "User:impersonate",
        "User:impersonate-admins",
        "User:delete",
        "User:set-password",
        "User:set-email",
        "User:get",
        "User:update",
        "Session:list",
        "Session:revoke",
        "Session:delete",
      ],
      user: [],
    });
  });
});
