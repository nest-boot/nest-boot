import { Account } from "./account.entity.js";
import { ApiKey } from "./api-key.entity.js";
import { Invitation } from "./invitation.entity.js";
import { Member } from "./member.entity.js";
import { Session } from "./session.entity.js";
import { User } from "./user.entity.js";
import { Verification } from "./verification.entity.js";
import { Workspace } from "./workspace.entity.js";
/** Internal Better Auth model-to-entity mapping. */
export const authEntityMap = {
  user: User,
  account: Account,
  session: Session,
  verification: Verification,
  workspace: Workspace,
  member: Member,
  invitation: Invitation,
  apiKey: ApiKey,
};
