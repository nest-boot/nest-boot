import { type Opt, type Ref } from "@mikro-orm/core";

import { ApiKeyFields } from "./api-key-fields.js";
import { SystemAccount } from "./system-account.entity.js";

/** authorization view of a key owned by an independent platform system account. */
export class SystemAccountApiKey extends ApiKeyFields {
  /** Concrete owning identity for this public credential view. */
  declare owner: Ref<SystemAccount>;

  /**
   * Reference to the owning systemAccount.
   * @returns Required owner reference for this credential kind.
   */
  override get systemAccount(): Ref<SystemAccount> {
    return this.owner;
  }

  /** Explicit grants; an empty list grants no operations. */
  declare permissions: Opt<string[]>;

  /**
   * Identifier of the credential's system identity for internal authorization.
   * @returns Identifier of the system account owning the credential.
   */
  override get systemAccountId(): Opt<string> {
    return super.systemAccountId;
  }
}
