import { describe, expect, it } from "vitest";

import {
  flattenWorkspacePermissions,
  groupWorkspacePermissions,
} from "./workspace-permissions";

describe("workspace permissions", () => {
  it("flattens supported resource actions for the checkbox UI", () => {
    expect(
      flattenWorkspacePermissions({
        workspace: ["manage", "update"],
        workspaceMember: ["manage"],
        unknown: ["manage"],
      }),
    ).toEqual(["workspace:manage", "workspaceMember:manage"]);
  });

  it("groups selected permissions by resource", () => {
    expect(
      groupWorkspacePermissions(["workspace:manage", "workspaceMember:manage"]),
    ).toEqual({
      workspace: ["manage"],
      workspaceMember: ["manage"],
    });
  });
});
