import { describe, expect, it } from "vitest";

import {
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLES,
} from "./user.constants.js";

describe("DEFAULT_USER_ROLES", () => {
  it("declares the complete default user permission catalog", () => {
    expect(DEFAULT_USER_PERMISSIONS).toContain("user:set-role");
    expect(DEFAULT_USER_PERMISSIONS).toContain("session:revoke");
  });

  it("grants the standard admin permissions and no permissions to users", () => {
    expect(DEFAULT_USER_ROLES).toEqual({
      admin: [
        "user:create",
        "user:list",
        "user:set-role",
        "user:ban",
        "user:impersonate",
        "user:impersonate-admins",
        "user:delete",
        "user:set-password",
        "user:set-email",
        "user:get",
        "user:update",
        "session:list",
        "session:revoke",
        "session:delete",
      ],
      user: [],
    });
  });
});
