import { ApiKey } from "../api-key/entities/api-key.entity.js";
import { SystemAccount } from "../api-key/entities/system-account.entity.js";
import { Invitation } from "../workspace/entities/invitation.entity.js";
import { Member } from "../workspace/entities/member.entity.js";
import { Workspace } from "../workspace/entities/workspace.entity.js";
import { Account } from "./entities/account.entity.js";
import { Session } from "./entities/session.entity.js";
import { User } from "./entities/user.entity.js";
import { Verification } from "./entities/verification.entity.js";

/** Low-level classes for the complete auth graph; use getAuthEntities for feature-scoped ORM registration. */
export const entities = [
  User,
  Account,
  Session,
  Verification,
  ApiKey,
  SystemAccount,
];

/** Workspace entities, registered only when `workspace.enabled` is true. */
export const workspaceEntities = [Workspace, Member, Invitation];
