import { RequestContext } from "@nest-boot/request-context";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { MemberApiKey } from "../entities/member-api-key.entity.js";
import { User } from "../entities/user.entity.js";
import type { RequestPermissions } from "../interfaces/request-permissions.interface.js";
import { getCurrentApiKey } from "./get-current-api-key.util.js";
import {
  intersectPermissions,
  resolveMemberPermissions,
  resolveUserPermissions,
} from "./resolve-effective-permissions.util.js";
import { resolveRequestMember } from "./resolve-request-member.util.js";

const REQUEST_PERMISSIONS = Symbol("auth.requestPermissions");

/**
 * Invalidates the shared permission snapshot when the request identity changes.
 * @internal
 */
export function invalidateRequestPermissions(): void {
  if (RequestContext.isActive()) RequestContext.set(REQUEST_PERMISSIONS, null);
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
  if (!RequestContext.isActive())
    return { user: [], workspace: [], apiKey: null };
  const cached = RequestContext.get<{
    options: AuthModuleOptions;
    permissions: RequestPermissions;
  }>(REQUEST_PERMISSIONS);
  if (cached?.options === options) return cached.permissions;
  const user = RequestContext.get(User);
  const member = resolveRequestMember();
  const apiKey = getCurrentApiKey();
  const keyPermissions = Array.isArray(apiKey?.permissions)
    ? apiKey.permissions
    : [];
  const memberKey = apiKey instanceof MemberApiKey;
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
      member ? limit(resolveMemberPermissions(options, member)) : [],
    ),
  });
  RequestContext.set(REQUEST_PERMISSIONS, { options, permissions });
  return permissions;
}
