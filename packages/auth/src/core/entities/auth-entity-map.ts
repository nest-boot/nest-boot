import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceInvitation } from "../../workspace/entities/workspace-invitation.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { Account } from "./account.entity.js";
import { Session } from "./session.entity.js";
import { User } from "./user.entity.js";
import { Verification } from "./verification.entity.js";
/** Internal Better Auth model-to-entity mapping. */
export const authEntityMap = {
  user: User,
  account: Account,
  session: Session,
  verification: Verification,
};

/** Workspace models added only for enabled workspace features. */
export const workspaceEntityMap = {
  workspace: Workspace,
  member: WorkspaceMember,
  invitation: WorkspaceInvitation,
};
