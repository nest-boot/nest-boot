import type { SystemAccount } from "../entities/system-account.entity.js";
import type { SystemApiKey } from "../objects/system-api-key.object.js";
/** Successfully authenticated independent system credential. */
export interface SystemApiKeyValidation {
  apiKey: SystemApiKey;
  ownerType: "system_account";
  systemAccount: SystemAccount;
}
