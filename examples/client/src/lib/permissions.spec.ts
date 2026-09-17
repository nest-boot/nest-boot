import { describe, expect, it } from "vitest";

import {
  authPermissionOptions,
  authPermissionValues,
  getPermissionOptions,
  isAuthPermission,
  userPermissionValues,
  workspaceApiKeyPermissionOptions,
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
    expect(
      workspaceApiKeyPermissionOptions.find(
        ({ value }) => value === "INVITATION__CREATE",
      )?.grantable,
    ).toBe(false);
    expect(
      authPermissionOptions.find(({ value }) => value === "INVITATION__CREATE")
        ?.grantable,
    ).not.toBe(false);
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
