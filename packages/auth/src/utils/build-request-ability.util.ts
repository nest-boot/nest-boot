import { RequestContext } from "@nest-boot/request-context";

import type { UserAbility } from "../abilities/user.ability.js";
import type { WorkspaceAbility } from "../abilities/workspace.ability.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { AuthAbilityFactory } from "../infrastructure/auth-ability.factory.js";
import { getCurrentApiKey } from "./get-current-api-key.util.js";
import { resolveRequestPermissions } from "./resolve-request-permissions.util.js";

/** Builds user abilities from the current identity, retaining API-key ceilings. */
export function buildRequestUserAbility(
  options: AuthModuleOptions,
): UserAbility | null {
  const user = RequestContext.get(User);
  if (!user || getCurrentApiKey() instanceof WorkspaceApiKey) return null;
  return AuthAbilityFactory.createUserAbility(
    resolveRequestPermissions(options).user,
    user,
    options.user,
  );
}

/** Builds workspace abilities only while the request has an active workspace identity. */
export function buildRequestWorkspaceAbility(
  options: AuthModuleOptions,
): WorkspaceAbility | null {
  const workspace = RequestContext.get(Workspace);
  const member = RequestContext.get(Member);
  if (
    !workspace ||
    (!member && !(getCurrentApiKey() instanceof WorkspaceApiKey))
  )
    return null;
  return AuthAbilityFactory.createWorkspaceAbility(
    resolveRequestPermissions(options).workspace,
    workspace,
    options.workspace,
  );
}
