import type { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";

import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { API_KEY } from "../auth.constants.js";
import { Member } from "../entities/member.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import type { ApiKey } from "../types/api-key.type.js";

/** Revokes the entire request identity without falling back to a less restricted credential. */
export function clearRequestAuthentication(em: EntityManager): void {
  if (RequestContext.isActive()) {
    RequestContext.set<ApiKey | null>(API_KEY, null);
    RequestContext.set<Session | null>(Session, null);
    RequestContext.set<User | null>(User, null);
    RequestContext.set<Member | null>(Member, null);
    RequestContext.set<Workspace | null>(Workspace, null);
    RequestContext.set(UserAbility, new UserAbility());
    RequestContext.set(WorkspaceAbility, new WorkspaceAbility());
  }
  if (em.getSessionContext()) {
    em.setSessionContext({
      role: "anonymous",
      variables: {
        "app.user.id": "",
        "app.user.permissions": "[]",
        "app.workspace.id": "",
        "app.workspace.permissions": "[]",
      },
    });
  }
}
