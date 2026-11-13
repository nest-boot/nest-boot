/** Options for changing the authenticated user's password. */
export interface ChangeAuthPasswordOptions {
  /** Current password used to authorize the change. */
  currentPassword: string;
  /** New password. */
  newPassword: string;
  /** Whether every session except the replacement session is revoked. */
  revokeOtherSessions?: boolean;
}
