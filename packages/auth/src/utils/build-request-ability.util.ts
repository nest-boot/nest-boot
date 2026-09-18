import { AbilityBuilder } from "@casl/ability";
import { RequestContext } from "@nest-boot/request-context";

import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { getCurrentApiKey } from "./get-current-api-key.util.js";
import { resolveRequestPermissions } from "./resolve-request-permissions.util.js";

/** Builds user abilities from the current identity, retaining API-key ceilings. */
export function buildRequestUserAbility(
  options: AuthModuleOptions,
): UserAbility | null {
  const user = RequestContext.get(User);
  if (!options.user?.buildAbility || !user) return null;
  return options.user.buildAbility(
    new AbilityBuilder(UserAbility),
    resolveRequestPermissions(options).user,
    user,
  );
}

/** Builds workspace abilities only while the request has an active workspace identity. */
export function buildRequestWorkspaceAbility(
  options: AuthModuleOptions,
): WorkspaceAbility | null {
  const workspace = RequestContext.get(Workspace);
  const member = RequestContext.get(Member);
  if (
    !options.workspace?.buildAbility ||
    !workspace ||
    (!member && !(getCurrentApiKey() instanceof WorkspaceApiKey))
  )
    return null;
  return options.workspace.buildAbility(
    new AbilityBuilder(WorkspaceAbility),
    resolveRequestPermissions(options).workspace,
    workspace,
  );
}
