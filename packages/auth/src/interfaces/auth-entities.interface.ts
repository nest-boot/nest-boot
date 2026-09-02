import type { Ref } from "@mikro-orm/core";

import type { BaseUser } from "../entities/user.entity.js";

/** Workspace roles understood by the built-in authorization services. */
export type AuthWorkspaceMemberRole = "ADMIN" | "MEMBER" | "OWNER";

/** Workspace-member states understood by the built-in authentication services. */
export type AuthWorkspaceMemberStatus =
  | "ACTIVE"
  | "DISABLED"
  | "INVITE_EXPIRED"
  | "INVITING";

/** Minimum shape required from an application workspace entity. */
export interface AuthWorkspaceEntity {
  /** Workspace identifier. */
  id: string;
  /** Workspace display name. */
  name: string;
  /** Soft-deletion timestamp. */
  deletedAt?: Date | null;
}

/** Minimum shape required from an application workspace-member entity. */
export interface AuthWorkspaceMemberEntity {
  /** Workspace-member identifier. */
  id: string;
  /** Member display name. */
  name: string;
  /** Member email address. */
  email?: null | string;
  /** Member role used by workspace and API-key authorization. */
  role: AuthWorkspaceMemberRole;
  /** Member lifecycle status. */
  status: AuthWorkspaceMemberStatus;
  /** User associated with this member, when it represents a user. */
  user?: null | Ref<BaseUser>;
  /** Workspace that owns this member. */
  workspace: Ref<AuthWorkspaceEntity>;
}

/** Minimum shape required from an application API-key entity. */
export interface AuthApiKeyEntity {
  /** API-key identifier. */
  id: string;
  /** API-key display name. */
  name: string;
  /** Indexed identifier embedded in the plaintext key. */
  keyId: string;
  /** Public prefix embedded in the plaintext key. */
  keyPrefix: string;
  /** Encrypted key secret stored by the application. */
  encryptedSecret: string;
  /** Last update timestamp. */
  updatedAt: Date;
  /** Last successful usage timestamp. */
  lastUsedAt?: Date | null;
  /** Expiration timestamp; `null` means the key does not expire. */
  expiresAt?: Date | null;
  /** Workspace that owns the key. */
  workspace: Ref<AuthWorkspaceEntity>;
  /** Workspace member represented by the key. */
  member: Ref<AuthWorkspaceMemberEntity>;
}
