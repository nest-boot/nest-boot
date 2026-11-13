import { RequestContext } from "@nest-boot/request-context";

import { getCurrentApiKey } from "../../api-key/utils/get-current-api-key.util.js";
import { resolveRequestPermissions } from "../../common/utils/resolve-request-permissions.util.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import { Workspace } from "../entities/workspace.entity.js";
import { resolveRequestWorkspaceMember } from "./resolve-request-workspace-member.util.js";

/**
 * Resolves the authenticated workspace scope independently of the selected target.
 * @param options - Authentication configuration and credential grant ceilings.
 * @returns Selected workspace when backed by a valid member or system workspace grant.
 */
export function resolveAuthWorkspace(
  options: AuthModuleOptions,
): Workspace | null {
  if (!RequestContext.isActive() || options.workspace?.enabled !== true) {
    return null;
  }
  const workspace = RequestContext.get(Workspace);
  if (!workspace) {
    return null;
  }
  if (resolveRequestWorkspaceMember()) {
    return workspace;
  }
  return getCurrentApiKey()?.ownerType === "system_account" &&
    resolveRequestPermissions(options).user.some((permission) =>
      permission.startsWith("workspace:"),
    )
    ? workspace
    : null;
}
