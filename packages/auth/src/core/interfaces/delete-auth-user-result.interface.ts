/** Result of requesting deletion of the authenticated user. */
export interface DeleteAuthUserResult {
  /** Human-readable result supplied by the authentication backend. */
  message: string;
  /** Whether the deletion request was accepted. */
  success: boolean;
}
