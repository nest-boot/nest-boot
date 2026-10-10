/** Identifies a linked authentication account. */
export type AuthAccountSelector =
  | {
      /** Better Auth account record identifier. */
      accountId: string;
      /** Optional user identifier for trusted server-side administration flows. */
      userId?: string;
    }
  | {
      /** Selects the account stored in Better Auth's short-lived account cookie. */
      useAccountCookie: true;
      /** Optional user identifier for trusted server-side administration flows. */
      userId?: string;
    };
