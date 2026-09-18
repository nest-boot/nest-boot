import type { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";

import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import {
  buildRequestUserAbility,
  buildRequestWorkspaceAbility,
} from "./build-request-ability.util.js";
import { resolveRequestPermissions } from "./resolve-request-permissions.util.js";

/** Refreshes post-commit authorization; custom ability failures must not retain old grants. */
export function refreshRequestAuthorization(
  em: EntityManager,
  options: AuthModuleOptions,
): void {
  RequestContext.set(UserAbility, new UserAbility());
  RequestContext.set(WorkspaceAbility, new WorkspaceAbility());
  if (em.getSessionContext()) {
    const permissions = resolveRequestPermissions(options);
    em.setSessionContext({
      variables: {
        "app.user.permissions": JSON.stringify(permissions.user),
        "app.workspace.permissions": JSON.stringify(permissions.workspace),
      },
    });
  }
  const userAbility = buildRequestUserAbility(options);
  const workspaceAbility = buildRequestWorkspaceAbility(options);
  RequestContext.set(UserAbility, userAbility);
  RequestContext.set(WorkspaceAbility, workspaceAbility);
}
