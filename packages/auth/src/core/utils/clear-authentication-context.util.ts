import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";

import { ApiKey } from "../../api-key/entities/api-key.entity.js";
import { AuthAbility } from "../../common/auth.ability.js";
import { invalidateRequestPermissions } from "../../common/utils/resolve-request-permissions.util.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { SELECTED_WORKSPACE } from "../constants/auth.constants.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";

/**
 * Clears a rejected identity, including at the non-Nest Better Auth adapter boundary.
 */
export function clearAuthenticationContext(): void {
  if (!RequestContext.isActive()) {
    return;
  }
  RequestContext.set(User, null);
  RequestContext.set(Session, null);
  RequestContext.set(ApiKey, null);
  RequestContext.set(Workspace, null);
  RequestContext.set(WorkspaceMember, null);
  invalidateRequestPermissions();
  // Revocation drops all prepared grants. Anonymous public handlers use @Public
  // and explicit public RLS policies; can()/authorize() require a credential.
  RequestContext.set(AuthAbility, new AuthAbility());

  const em = RequestContext.get(EntityManager);
  if (em?.getSessionContext()) {
    em.setSessionContext({
      role: "anonymous",
      variables: {
        "app.auth.user.id": "",
        "app.auth.workspace.id": "",
        "app.auth.workspace_member.id": "",
        "app.selected.workspace.id":
          RequestContext.get<Workspace | null>(SELECTED_WORKSPACE)?.id ?? "",
      },
    });
  }
}
