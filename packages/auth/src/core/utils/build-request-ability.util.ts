import { RequestContext } from "@nest-boot/request-context";

import { getCurrentApiKey } from "../../api-key/utils/get-current-api-key.util.js";
import type { AuthAbility } from "../../common/auth.ability.js";
import { resolveRequestPermissions } from "../../common/utils/resolve-request-permissions.util.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { resolveAuthWorkspace } from "../../workspace/utils/resolve-auth-workspace.util.js";
import { resolveRequestWorkspaceMember } from "../../workspace/utils/resolve-request-workspace-member.util.js";
import { createAuthAbility } from "../auth-ability.factory.js";
import { SELECTED_WORKSPACE } from "../constants/auth.constants.js";
import { User } from "../entities/user.entity.js";
import type { AuthModuleOptions } from "../interfaces/auth-module-options.interface.js";

/**
 * Builds one ability from the current identity and credential-limited permission snapshot.
 * @param options - Authentication module configuration.
 * @returns Ability for the supplied identity and resolved request permissions.
 */
export function buildRequestAbility(options: AuthModuleOptions): AuthAbility {
  const apiKey = getCurrentApiKey();
  const memberKey = apiKey?.ownerType === "workspace_member";
  const user = memberKey ? null : (RequestContext.get(User) ?? null);
  const member =
    options.workspace?.enabled === true
      ? resolveRequestWorkspaceMember()
      : null;
  const workspace = resolveAuthWorkspace(options);
  const permissions = resolveRequestPermissions(options);
  return createAuthAbility(
    {
      user,
      workspace,
      selectedWorkspace:
        options.workspace?.enabled === true
          ? (RequestContext.get<Workspace | null>(SELECTED_WORKSPACE) ?? null)
          : null,
      member,
      userPermissions:
        user || apiKey?.ownerType === "system_account" ? permissions.user : [],
      systemAccount:
        apiKey?.ownerType === "system_account"
          ? apiKey.systemAccount?.unwrap()
          : undefined,
      workspacePermissions: workspace ? permissions.workspace : [],
    },
    options,
  );
}
