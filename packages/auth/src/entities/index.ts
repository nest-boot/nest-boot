import { Account } from "./account.entity.js";
import { ApiKeyEntity } from "./api-key.entity.js";
import { Invitation } from "./invitation.entity.js";
import { Member } from "./member.entity.js";
import { Session } from "./session.entity.js";
import { SystemAccount } from "./system-account.entity.js";
import { User } from "./user.entity.js";
import { Verification } from "./verification.entity.js";
import { Workspace } from "./workspace.entity.js";
export * from "./account.entity.js";
export * from "./api-key.entity.js";
export * from "./invitation.entity.js";
export * from "./member.entity.js";
export * from "./member-api-key.entity.js";
export * from "./session.entity.js";
export * from "./user.entity.js";
export * from "./user-api-key.entity.js";
export * from "./verification.entity.js";
export * from "./workspace.entity.js";

/** Low-level classes for the complete auth graph; use getAuthEntities for feature-scoped ORM registration. */
export const entities = [
  User,
  Account,
  Session,
  Verification,
  ApiKeyEntity,
  SystemAccount,
];

/** Workspace entities, registered only when `workspace.enabled` is true. */
export const workspaceEntities = [Workspace, Member, Invitation];

export { getAuthEntities } from "./get-auth-entities.js";
export * from "./system-account.entity.js";
export * from "./system-account-api-key.entity.js";
