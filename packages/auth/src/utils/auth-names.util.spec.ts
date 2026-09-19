import { assertAuthRolePermissions } from "./auth-role.util.js";

describe("auth configuration names", () => {
  it.each([
    "Owner",
    "team_admin",
    "super--admin",
    "super---admin",
    "2admin",
    "_admin",
    "true",
    "false",
    "null",
    "admin\n",
    "",
  ])("rejects role %j", (role) => {
    expect(() => {
      assertAuthRolePermissions({ [role]: [] }, [], "user");
    }).toThrow("Invalid user role name");
  });
  it.each([
    "User:read",
    "user:Read",
    "read",
    "user:",
    ":read",
    "user:read:extra",
    "user:read\n",
    "2user:read",
    "user:_read",
    "api_key:read",
    "user:set_role",
    "api--key:read",
    "api---key:read",
    "user:set--role",
    "user:set---role",
  ])("rejects permission %j", (permission) => {
    expect(() => {
      assertAuthRolePermissions({ user: [] }, [permission], "user");
    }).toThrow("Invalid user permission name");
  });
  it("accepts exact lowercase identifiers", () => {
    expect(() => {
      assertAuthRolePermissions(
        { "super-admin": ["api-key:set-role"] },
        ["api-key:set-role"],
        "user",
      );
    }).not.toThrow();
  });
});
