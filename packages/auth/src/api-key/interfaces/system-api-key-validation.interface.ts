import type { OwnedApiKey } from "../entities/api-key.entity.js";
import type { SystemAccount } from "../entities/system-account.entity.js";

/** Successfully authenticated independent system credential. */
export interface SystemApiKeyValidation {
  apiKey: OwnedApiKey<"system_account">;
  ownerType: "system_account";
  systemAccount: SystemAccount;
}
