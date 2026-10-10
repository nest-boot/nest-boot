import type { AuthAccount } from "./auth-account.interface.js";
import type { AuthProviderUserInfo } from "./auth-provider-user-info.interface.js";

/** Information associated with a linked authentication account. */
export interface AuthAccountInfo<
  UserInfo extends AuthProviderUserInfo = AuthProviderUserInfo,
  Data extends object = Record<string, unknown>,
> {
  /** Linked account identity. */
  account: Pick<AuthAccount, "id" | "providerId" | "issuer" | "accountId">;
  /** Provider user information. */
  user: UserInfo;
  /** Provider-specific account data. */
  data: Data;
}
