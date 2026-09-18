import { RequestContext } from "@nest-boot/request-context";

import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import {
  buildRequestUserAbility,
  buildRequestWorkspaceAbility,
} from "./build-request-ability.util.js";

/** Refreshes post-commit authorization; custom ability failures must not retain old grants. */
export function refreshRequestAuthorization(options: AuthModuleOptions): void {
  RequestContext.set(UserAbility, new UserAbility());
  RequestContext.set(WorkspaceAbility, new WorkspaceAbility());
  const userAbility = buildRequestUserAbility(options);
  const workspaceAbility = buildRequestWorkspaceAbility(options);
  RequestContext.set(UserAbility, userAbility);
  RequestContext.set(WorkspaceAbility, workspaceAbility);
}
