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
      "Workspace:update",
      "Workspace:delete",
      "WorkspaceMember:create",
      "WorkspaceMember:update",
      "WorkspaceMember:delete",
      "WorkspaceInvitation:create",
      "WorkspaceInvitation:cancel",
      "ApiKey:read",
      "ApiKey:create",
      "ApiKey:update",
      "ApiKey:delete",
    ]);
  });

  it("keeps workspace API-key permissions inside the mixed catalog", () => {
    expect(workspaceApiKeyPermissionValues).toContain("Workspace:update");
    expect(workspaceApiKeyPermissionValues).toContain(
      "WorkspaceInvitation:cancel",
    );
    expect(workspaceApiKeyPermissionValues).not.toContain("User:delete");
  });

  it("exposes user and workspace permissions for personal API keys", () => {
    expect(authPermissionValues).toEqual([
      ...new Set([...userPermissionValues, ...workspacePermissionValues]),
    ]);
    expect(authPermissionOptions.map((entry) => entry.value)).toEqual(
      authPermissionValues,
    );
    for (const permission of [
      "ApiKey:read",
      "ApiKey:create",
      "ApiKey:update",
      "ApiKey:delete",
    ]) {
      expect(userPermissionValues).toContain(permission);
      expect(workspaceApiKeyPermissionValues).toContain(permission);
      expect(
        authPermissionValues.filter((value) => value === permission),
      ).toHaveLength(1);
    }
  });

  it("narrows server strings against the local permission catalog", () => {
    expect(isUserPermission("User:get")).toBe(true);
    expect(isWorkspacePermission("Workspace:update")).toBe(true);
    expect(isAuthPermission("custom:unknown")).toBe(false);
  });
});
