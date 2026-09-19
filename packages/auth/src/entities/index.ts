import { Account } from "./account.entity.js";
import { Invitation } from "./invitation.entity.js";
import { Member } from "./member.entity.js";
import { Session } from "./session.entity.js";
import { User } from "./user.entity.js";
import { UserApiKey } from "./user-api-key.entity.js";
import { Verification } from "./verification.entity.js";
import { Workspace } from "./workspace.entity.js";
import { WorkspaceApiKey } from "./workspace-api-key.entity.js";
export * from "./account.entity.js";
export * from "./invitation.entity.js";
export * from "./member.entity.js";
export * from "./session.entity.js";
export * from "./user.entity.js";
export * from "./user-api-key.entity.js";
export * from "./verification.entity.js";
export * from "./workspace.entity.js";
export * from "./workspace-api-key.entity.js";

/** Built-in authentication entities for MikroORM runtime and migration discovery. */
export const entities = [
  User,
  Account,
  Session,
  Verification,
  Workspace,
  Member,
  Invitation,
  UserApiKey,
  WorkspaceApiKey,
];
