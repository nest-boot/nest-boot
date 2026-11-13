import type { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";

import { AuthAbility } from "../../common/auth.ability.js";
import { invalidateRequestPermissions } from "../../common/utils/resolve-request-permissions.util.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { API_KEY, AUTH_WORKSPACE } from "../constants/auth.constants.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
/**
 * Clears a rejected identity, including at the non-Nest Better Auth adapter boundary.
 * @param em - Entity manager for this persistence boundary.
 */
export function clearAuthenticationContext(em: EntityManager): void {
  if (RequestContext.isActive()) {
    RequestContext.set(User, null);
    RequestContext.set(WorkspaceMember, null);
    RequestContext.set(Session, null);
    RequestContext.set(API_KEY, null);
    RequestContext.set(AUTH_WORKSPACE, null);
    invalidateRequestPermissions();
    // Revocation drops all prepared grants. Anonymous public handlers use @Public
    // and explicit public RLS policies; can()/authorize() require a credential.
    RequestContext.set(AuthAbility, new AuthAbility());
  }
  if (em.getSessionContext()) {
    em.setSessionContext({
      role: "anonymous",
      variables: {
        "app.auth.user.id": "",
        "app.auth.workspace.id": "",
        "app.selected.workspace.id": RequestContext.isActive()
          ? (RequestContext.get(Workspace)?.id ?? "")
          : "",
        "app.auth.workspace_member.id": "",
      },
    });
  }
}
