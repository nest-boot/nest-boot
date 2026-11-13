import { RequestContext } from "@nest-boot/request-context";

import { resolveApiKeyPermissionCatalog } from "../../api-key/utils/api-key-permissions.util.js";
import { getCurrentApiKey } from "../../api-key/utils/get-current-api-key.util.js";
import { User } from "../../core/entities/user.entity.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import { resolveRequestWorkspaceMember } from "../../workspace/utils/resolve-request-workspace-member.util.js";
import type { RequestPermissions } from "../interfaces/request-permissions.interface.js";
import {
  intersectPermissions,
  resolveUserPermissions,
  resolveWorkspaceMemberPermissions,
} from "./resolve-effective-permissions.util.js";

const REQUEST_PERMISSIONS = Symbol("auth.requestPermissions");

/**
 * Invalidates the shared permission snapshot when the request identity changes.
 * @internal
 */
export function invalidateRequestPermissions(): void {
  if (RequestContext.isActive()) {
    RequestContext.set(REQUEST_PERMISSIONS, null);
  }
}

/**
 * Resolves one credential-limited permission snapshot per request identity.
 * @param options - Authentication module configuration.
 * @returns Effective user and workspace permissions, restricted by the active API key.
 * @internal
 */
export function resolveRequestPermissions(
  options: AuthModuleOptions,
): RequestPermissions {
  if (!RequestContext.isActive()) {
    return { user: [], workspace: [], apiKey: null };
  }
  const cached = RequestContext.get<{
    options: AuthModuleOptions;
    permissions: RequestPermissions;
  }>(REQUEST_PERMISSIONS);
  if (cached?.options === options) {
    return cached.permissions;
  }
  const user = RequestContext.get(User);
  const member =
    options.workspace?.enabled === true
      ? resolveRequestWorkspaceMember()
      : null;
  const apiKey = getCurrentApiKey();
  const keyPermissions = Array.isArray(apiKey?.permissions)
    ? apiKey.permissions
    : [];
  if (apiKey?.ownerType === "system_account") {
    const account = apiKey.systemAccount?.unwrap();
    const allowed = resolveApiKeyPermissionCatalog(
      options,
      "systemAccount",
    ).allowed;
    const grants = account?.enabled
      ? intersectPermissions(
          intersectPermissions(account.permissions, keyPermissions),
          allowed,
        )
      : [];
    const permissions = Object.freeze({
      user: Object.freeze(grants),
      workspace: Object.freeze([] as string[]),
      apiKey: Object.freeze([...keyPermissions]),
    });
    RequestContext.set(REQUEST_PERMISSIONS, { options, permissions });
    return permissions;
  }
  const memberKey = apiKey?.ownerType === "workspace_member";
  const unrestricted =
    !apiKey || (Array.isArray(apiKey.permissions) && !keyPermissions.length);
  const limit = (permissions: readonly string[]) =>
    unrestricted
      ? permissions
      : intersectPermissions(permissions, keyPermissions);
  const permissions = Object.freeze({
    apiKey: unrestricted ? null : Object.freeze([...new Set(keyPermissions)]),
    user: Object.freeze(
      user && !memberKey ? limit(resolveUserPermissions(options, user)) : [],
    ),
    workspace: Object.freeze(
      member ? limit(resolveWorkspaceMemberPermissions(options, member)) : [],
    ),
  });
  RequestContext.set(REQUEST_PERMISSIONS, { options, permissions });
  return permissions;
}
