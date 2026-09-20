import { RequestContext } from "@nest-boot/request-context";

import type { AuthAbility } from "../abilities/auth.ability.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { AuthAbilityFactory } from "../infrastructure/auth-ability.factory.js";
import { getCurrentApiKey } from "./get-current-api-key.util.js";
import { resolveRequestPermissions } from "./resolve-request-permissions.util.js";

/** Builds one ability from the current identity and credential-limited permission snapshot. */
export function buildRequestAbility(options: AuthModuleOptions): AuthAbility {
  const apiKey = getCurrentApiKey();
  const workspaceKey = apiKey instanceof WorkspaceApiKey;
  const user = workspaceKey ? null : (RequestContext.get(User) ?? null);
  const selectedWorkspace = RequestContext.get(Workspace);
  const currentMember = RequestContext.get(Member);
  const member =
    user &&
    currentMember?.status === "ACTIVE" &&
    currentMember.user?.id === user.id &&
    currentMember.workspace?.id === selectedWorkspace?.id
      ? currentMember
      : null;
  const workspace =
    selectedWorkspace &&
    (member || (workspaceKey && apiKey.workspace?.id === selectedWorkspace.id))
      ? selectedWorkspace
      : null;
  const permissions = resolveRequestPermissions(options);
  return AuthAbilityFactory.createAbility(
    {
      user,
      workspace,
      member,
      userPermissions: user ? permissions.user : [],
      workspacePermissions: workspace ? permissions.workspace : [],
    },
    options,
  );
}
