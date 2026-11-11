import { RequestContext } from "@nest-boot/request-context";

import type { AuthAbility } from "../auth.ability.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { AuthAbilityFactory } from "../infrastructure/auth-ability.factory.js";
import { getCurrentApiKey } from "./get-current-api-key.util.js";
import { resolveRequestMember } from "./resolve-request-member.util.js";
import { resolveRequestPermissions } from "./resolve-request-permissions.util.js";

/**
 * Builds one ability from the current identity and credential-limited permission snapshot.
 * @param options - Authentication module configuration.
 * @returns Ability for the supplied identity and resolved request permissions.
 */
export function buildRequestAbility(options: AuthModuleOptions): AuthAbility {
  const apiKey = getCurrentApiKey();
  const memberKey = apiKey?.ownerType === "member";
  const user = memberKey ? null : (RequestContext.get(User) ?? null);
  const member =
    options.workspace?.enabled === true ? resolveRequestMember() : null;
  const workspace = member ? (RequestContext.get(Workspace) ?? null) : null;
  const permissions = resolveRequestPermissions(options);
  return AuthAbilityFactory.createAbility(
    {
      user,
      workspace,
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
