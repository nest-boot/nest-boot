import { RequestContext } from "@nest-boot/request-context";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import type { RequestPermissions } from "../interfaces/request-permissions.interface.js";
import { getCurrentApiKey } from "./get-current-api-key.util.js";
import {
  intersectPermissions,
  resolveMemberPermissions,
  resolveUserPermissions,
} from "./resolve-effective-permissions.util.js";

const REQUEST_PERMISSIONS = Symbol("auth.requestPermissions");

/** Invalidates the shared permission snapshot when the request identity changes. @internal */
export function invalidateRequestPermissions(): void {
  if (RequestContext.isActive()) RequestContext.set(REQUEST_PERMISSIONS, null);
}

/** Resolves one credential-limited permission snapshot per request identity. @internal */
export function resolveRequestPermissions(
  options: AuthModuleOptions,
): RequestPermissions {
  if (!RequestContext.isActive())
    return { user: [], workspace: [], apiKey: null };
  const cached = RequestContext.get<{
    options: AuthModuleOptions;
    permissions: RequestPermissions;
  }>(REQUEST_PERMISSIONS);
  if (cached?.options === options) return cached.permissions;
  const user = RequestContext.get(User);
  const member = RequestContext.get(Member);
  const workspace = RequestContext.get(Workspace);
  const apiKey = getCurrentApiKey();
  const keyPermissions = Array.isArray(apiKey?.permissions)
    ? apiKey.permissions
    : [];
  const workspaceKey = apiKey instanceof WorkspaceApiKey;
  const limit = (permissions: readonly string[]) =>
    apiKey ? intersectPermissions(permissions, keyPermissions) : permissions;
  const permissions = Object.freeze({
    apiKey: apiKey ? Object.freeze([...new Set(keyPermissions)]) : null,
    user: Object.freeze(
      user && !workspaceKey ? limit(resolveUserPermissions(options, user)) : [],
    ),
    workspace: Object.freeze(
      !workspace
        ? []
        : workspaceKey
          ? [...new Set(keyPermissions)]
          : member
            ? limit(resolveMemberPermissions(options, member))
            : [],
    ),
  });
  RequestContext.set(REQUEST_PERMISSIONS, { options, permissions });
  return permissions;
}
