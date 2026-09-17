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
    expect(workspacePermissionValues).toEqual(
      [
        "WORKSPACE__UPDATE",
        "WORKSPACE__DELETE",
        "MEMBER__CREATE",
        "MEMBER__UPDATE",
        "MEMBER__DELETE",
        "INVITATION__CREATE",
        "INVITATION__CANCEL",
        "API_KEY__READ",
        "API_KEY__CREATE",
        "API_KEY__UPDATE",
        "API_KEY__DELETE",
      ].sort(),
    );
  });

  it("keeps workspace API-key permissions inside the mixed catalog", () => {
    expect(workspaceApiKeyPermissionValues).toContain("WORKSPACE__UPDATE");
    expect(workspaceApiKeyPermissionValues).toContain("INVITATION__CANCEL");
    expect(workspaceApiKeyPermissionValues).not.toContain("USER__DELETE");
  });

  it("exposes user and workspace permissions for personal API keys", () => {
    expect(authPermissionValues).toEqual(
      [
        ...new Set([...userPermissionValues, ...workspacePermissionValues]),
      ].sort(),
    );
    expect(authPermissionOptions.map((entry) => entry.value)).toEqual(
      authPermissionValues,
    );
    for (const permission of [
      "API_KEY__READ",
      "API_KEY__CREATE",
      "API_KEY__UPDATE",
      "API_KEY__DELETE",
    ]) {
      expect(userPermissionValues).toContain(permission);
      expect(workspaceApiKeyPermissionValues).toContain(permission);
      expect(
        authPermissionValues.filter((value) => value === permission),
      ).toHaveLength(1);
    }
  });

  it("narrows server strings against the local permission catalog", () => {
    expect(isUserPermission("USER__GET")).toBe(true);
    expect(isWorkspacePermission("WORKSPACE__UPDATE")).toBe(true);
    expect(isAuthPermission("CUSTOM__UNKNOWN")).toBe(false);
  });
});
