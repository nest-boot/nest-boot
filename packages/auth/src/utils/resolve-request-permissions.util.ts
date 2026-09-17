import { RequestContext } from "@nest-boot/request-context";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { DEFAULT_USER_ROLE, DEFAULT_USER_ROLES } from "../user.constants.js";
import { getCurrentApiKey } from "../utils/get-current-api-key.util.js";
import {
  DEFAULT_WORKSPACE_ROLE,
  DEFAULT_WORKSPACE_ROLES,
} from "../workspace.constants.js";
import { resolveAuthPermissions } from "./auth-role.util.js";

/** Resolves the same credential-limited grants for CASL and database request contexts. @internal */
export function resolveRequestPermissions(options: AuthModuleOptions): {
  user: readonly string[];
  workspace: readonly string[];
} {
  const user = RequestContext.get(User);
  const member = RequestContext.get(Member);
  const workspace = RequestContext.get(Workspace);
  const apiKey = getCurrentApiKey();
  const keyPermissions = Array.isArray(apiKey?.permissions)
    ? apiKey.permissions
    : [];
  const workspaceKey = apiKey instanceof WorkspaceApiKey;
  const limit = (permissions: readonly string[]) =>
    apiKey
      ? permissions.filter((permission) => keyPermissions.includes(permission))
      : permissions;

  return {
    user: user
      ? limit(
          resolveAuthPermissions(
            user.roles ?? [options.user?.defaultRole ?? DEFAULT_USER_ROLE],
            user.permissions ?? [],
            options.user?.roles ?? DEFAULT_USER_ROLES,
          ),
        )
      : [],
    workspace: !workspace
      ? []
      : workspaceKey
        ? [...new Set(keyPermissions)]
        : member
          ? limit(
              resolveAuthPermissions(
                member.roles ?? [
                  options.workspace?.defaultRole ?? DEFAULT_WORKSPACE_ROLE,
                ],
                member.permissions ?? [],
                options.workspace?.roles ?? DEFAULT_WORKSPACE_ROLES,
              ),
            )
          : [],
  };
}
