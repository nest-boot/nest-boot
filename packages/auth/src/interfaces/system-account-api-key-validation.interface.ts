import type { SystemAccount } from "../entities/system-account.entity.js";
import type { SystemAccountApiKey } from "../entities/system-account-api-key.entity.js";
/** Successfully authenticated independent system credential. */
export interface SystemAccountApiKeyValidation {
  apiKey: SystemAccountApiKey;
  ownerType: "system_account";
  systemAccount: SystemAccount;
}
