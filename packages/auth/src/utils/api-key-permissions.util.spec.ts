import { resolveApiKeyPermissionCatalog } from "./api-key-permissions.util.js";

describe("API key catalog snapshots", () => {
  it("reuses immutable catalogs and isolates scopes and module configurations", () => {
    const options = {
      apiKey: {
        user: { allowedPermissions: [], defaultPermissions: [] },
        workspace: {
          allowedPermissions: ["workspace:update"],
          defaultPermissions: ["workspace:update"],
        },
      },
    };
    const user = resolveApiKeyPermissionCatalog(options, "user");
    const workspace = resolveApiKeyPermissionCatalog(options, "workspace");
    expect(resolveApiKeyPermissionCatalog(options, "workspace")).toBe(
      workspace,
    );
    expect(user.allowed).toEqual([]);
    expect(workspace.allowed).toEqual(["workspace:update"]);
    expect(workspace.defaults).toEqual(["workspace:update"]);
    for (const value of [
      workspace,
      workspace.permissions,
      workspace.allowed,
      workspace.defaults,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    options.apiKey.workspace.defaultPermissions.push("workspace:delete");
    expect(workspace.defaults).toEqual(["workspace:update"]);
    expect(resolveApiKeyPermissionCatalog({}, "user").allowed).toContain(
      "user:get",
    );
  });
});
