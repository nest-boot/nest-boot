import type { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";

import { AuthAbility } from "../../common/auth.ability.js";
import { invalidateRequestPermissions } from "../../common/utils/resolve-request-permissions.util.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { API_KEY } from "../constants/auth.constants.js";
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
    RequestContext.set(Workspace, null);
    RequestContext.set(Session, null);
    RequestContext.set(API_KEY, null);
    invalidateRequestPermissions();
    RequestContext.set(AuthAbility, new AuthAbility());
  }
  if (em.getSessionContext()) {
    em.setSessionContext({
      role: "anonymous",
      variables: {
        "app.user.id": "",
        "app.workspace.id": "",
        "app.system_account.id": "",
        "app.member.id": "",
      },
    });
  }
}
