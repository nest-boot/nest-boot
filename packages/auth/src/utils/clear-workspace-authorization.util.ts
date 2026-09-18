import type { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";

import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { Member } from "../entities/member.entity.js";
import { Workspace } from "../entities/workspace.entity.js";

/** Revokes the selected workspace scope after a committed deletion or departure. */
export function clearWorkspaceAuthorization(em: EntityManager): void {
  if (RequestContext.isActive()) {
    RequestContext.set<Member | null>(Member, null);
    RequestContext.set<Workspace | null>(Workspace, null);
    RequestContext.set(WorkspaceAbility, new WorkspaceAbility());
  }
  if (em.getSessionContext()) {
    em.setSessionContext({
      variables: {
        "app.workspace.id": "",
      },
    });
  }
}
