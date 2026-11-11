import { ApiKey } from "../../api-key/entities/api-key.entity.js";
import { SystemAccount } from "../../api-key/entities/system-account.entity.js";
import { Invitation } from "../../workspace/entities/invitation.entity.js";
import { Member } from "../../workspace/entities/member.entity.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { Account } from "./account.entity.js";
import { Session } from "./session.entity.js";
import { User } from "./user.entity.js";
import { Verification } from "./verification.entity.js";
export * from "../../api-key/entities/api-key.entity.js";
export * from "../../api-key/entities/user-api-key.entity.js";
export * from "../../api-key/entities/workspace-api-key.entity.js";
export * from "../../workspace/entities/invitation.entity.js";
export * from "../../workspace/entities/member.entity.js";
export * from "../../workspace/entities/workspace.entity.js";
export * from "./account.entity.js";
export * from "./session.entity.js";
export * from "./user.entity.js";
export * from "./verification.entity.js";

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

export * from "../../api-key/entities/system-account.entity.js";
export * from "../../api-key/entities/system-api-key.entity.js";
export { getAuthEntities } from "./get-auth-entities.js";
