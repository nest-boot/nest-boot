/** Result of changing the authenticated user's password. */
export interface ChangeAuthPasswordResult {
  /** Replacement session token when other sessions were revoked. */
  token: string | null;
}
