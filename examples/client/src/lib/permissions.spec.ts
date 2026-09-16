import { describe, expect, it } from "vitest";

import {
  authPermissionOptions,
  authPermissionValues,
  isAuthPermission,
  isUserPermission,
  isWorkspacePermission,
  userPermissionValues,
  workspaceApiKeyPermissionValues,
  workspacePermissionValues,
} from "./permissions";

describe("permission options", () => {
  it("exposes the workspace permission catalog", () => {
    expect(workspacePermissionValues).toEqual([
      "workspace:update",
      "workspace:delete",
      "member:create",
      "member:update",
      "member:delete",
      "invitation:create",
      "invitation:cancel",
      "api-key:read",
      "api-key:create",
      "api-key:update",
      "api-key:delete",
    ]);
  });

  it("keeps workspace API-key permissions inside the mixed catalog", () => {
    expect(workspaceApiKeyPermissionValues).toContain("workspace:update");
    expect(workspaceApiKeyPermissionValues).toContain("invitation:cancel");
    expect(workspaceApiKeyPermissionValues).not.toContain("user:delete");
  });

  it("exposes user and workspace permissions for personal API keys", () => {
    expect(authPermissionValues).toEqual([
      ...new Set([...userPermissionValues, ...workspacePermissionValues]),
    ]);
    expect(authPermissionOptions.map((entry) => entry.value)).toEqual(
      authPermissionValues,
    );
    for (const permission of [
      "api-key:read",
      "api-key:create",
      "api-key:update",
      "api-key:delete",
    ]) {
      expect(userPermissionValues).toContain(permission);
      expect(workspaceApiKeyPermissionValues).toContain(permission);
      expect(
        authPermissionValues.filter((value) => value === permission),
      ).toHaveLength(1);
    }
  });

  it("narrows server strings against the local permission catalog", () => {
    expect(isUserPermission("user:get")).toBe(true);
    expect(isWorkspacePermission("workspace:update")).toBe(true);
    expect(isAuthPermission("custom:unknown")).toBe(false);
  });
});
