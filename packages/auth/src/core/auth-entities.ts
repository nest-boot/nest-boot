import { ApiKeySchema } from "../api-key/entities/api-key.entity-schema.js";
import { SystemAccount } from "../api-key/entities/system-account.entity.js";
import { InvitationSchema } from "../workspace/entities/invitation.entity-schema.js";
import { Member } from "../workspace/entities/member.entity.js";
import { Workspace } from "../workspace/entities/workspace.entity.js";
import { Account } from "./entities/account.entity.js";
import { Session } from "./entities/session.entity.js";
import { User } from "./entities/user.entity.js";
import { Verification } from "./entities/verification.entity.js";

/** Low-level classes for the complete auth graph; use AuthModule for feature-scoped ORM registration. */
export const entities = [
  User,
  Account,
  Session,
  Verification,
  ApiKeySchema,
  SystemAccount,
];

/** Workspace entities, registered only when `workspace.enabled` is true. */
export const workspaceEntities = [Workspace, Member, InvitationSchema];
