/** A safe summary of an authentication account linked to the current user. */
export interface AuthAccount {
  /** Better Auth account record identifier. */
  id: string;
  /** Identifier assigned by the authentication provider. */
  accountId: string;
  /** Stable issuer namespace paired with the provider account identifier. */
  issuer: string;
  /** Authentication provider identifier. */
  providerId: string;
  /** Identifier of the user that owns the account. */
  userId: string;
  /** OAuth scopes granted to the account. */
  scopes: string[];
  /** Timestamp when the account was linked. */
  createdAt: Date;
  /** Timestamp when the account was last updated. */
  updatedAt: Date;
}
