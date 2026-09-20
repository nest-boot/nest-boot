import { describe, expect, it } from "vitest";

import english from "../../public/locales/en/permission.json";
import chinese from "../../public/locales/zh/permission.json";

import {
  authPermissionValues,
  getDefaultApiKeyPermissions,
  getPermissionOptions,
  isAuthPermission,
  userPermissionValues,
  workspaceApiKeyPermissionValues,
  workspacePermissionValues,
} from "./permissions";

describe("permission options", () => {
  it("keeps both locale catalogs aligned with all built-in permissions", () => {
    const keys = authPermissionValues
      .map((value) => value.toLowerCase().replaceAll("__", "_"))
      .sort();
    for (const locale of [english, chinese]) {
      expect(
        Object.keys(locale)
          .filter((key) => !["label", "all"].includes(key))
          .sort(),
      ).toEqual(keys);
      for (const key of keys) {
        expect(locale).toHaveProperty(`${key}.name`, expect.any(String));
        expect(locale).toHaveProperty(`${key}.description`, expect.any(String));
      }
    }
  });
  it("selects only server defaults that the caller may grant", () => {
    expect(
      getDefaultApiKeyPermissions([
        { permission: "CUSTOM__READ", grantable: true, default: true },
        { permission: "CUSTOM__UPDATE", grantable: false, default: true },
        { permission: "CUSTOM__DELETE", grantable: true, default: false },
      ]),
    ).toEqual(["CUSTOM__READ"]);
    expect(getDefaultApiKeyPermissions([])).toEqual([]);
  });
  it("exposes the workspace permission catalog", () => {
    expect(workspacePermissionValues).toEqual(
      [
        "WORKSPACE__READ",
        "WORKSPACE__UPDATE",
        "WORKSPACE__DELETE",
        "MEMBER__READ",
        "MEMBER__WRITE",
        "MEMBER__SET_ROLES",
        "MEMBER__SET_PERMISSIONS",
        "MEMBER__INVITE",
        "WORKSPACE_API_KEY__READ",
        "WORKSPACE_API_KEY__WRITE",
      ].sort(),
    );
  });

  it("keeps workspace API-key permissions inside the mixed catalog", () => {
    expect(workspaceApiKeyPermissionValues).toContain("WORKSPACE__UPDATE");
    expect(workspaceApiKeyPermissionValues).toContain("MEMBER__INVITE");
    expect(workspaceApiKeyPermissionValues).not.toContain("USER__DELETE");
  });

  it("exposes user and workspace permissions for personal API keys", () => {
    expect(authPermissionValues).toEqual(
      [
        ...new Set([...userPermissionValues, ...workspacePermissionValues]),
      ].sort(),
    );
    for (const action of ["READ", "WRITE"]) {
      const userPermission = `USER_API_KEY__${action}`;
      const workspacePermission = `WORKSPACE_API_KEY__${action}`;
      expect(userPermissionValues).toContain(userPermission);
      expect(userPermissionValues).not.toContain(workspacePermission);
      expect(workspaceApiKeyPermissionValues).toContain(workspacePermission);
      expect(workspaceApiKeyPermissionValues).not.toContain(userPermission);
      expect(authPermissionValues).toContain(userPermission);
      expect(authPermissionValues).toContain(workspacePermission);
    }
  });

  it("narrows server strings against the local permission catalog", () => {
    expect(isAuthPermission("CUSTOM__UNKNOWN")).toBe(false);
  });

  it("uses the server catalog and preserves unavailable grants", () => {
    expect(
      getPermissionOptions([
        { permission: "CUSTOM__READ", grantable: true },
        { permission: "CUSTOM__DELETE", grantable: false },
      ]),
    ).toEqual([
      {
        value: "CUSTOM__READ",
        name: "permission:custom_read.name",
        description: "permission:custom_read.description",
        grantable: true,
      },
      {
        value: "CUSTOM__DELETE",
        name: "permission:custom_delete.name",
        description: "permission:custom_delete.description",
        grantable: false,
      },
    ]);
  });
});
