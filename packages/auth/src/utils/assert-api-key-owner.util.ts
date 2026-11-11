import type { MemberApiKey } from "../entities/member-api-key.entity.js";
import type { SystemAccountApiKey } from "../entities/system-account-api-key.entity.js";
import type { UserApiKey } from "../entities/user-api-key.entity.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";

interface OwnerViews {
  user: UserApiKey;
  member: MemberApiKey;
  system_account: SystemAccountApiKey;
}

/**
 * Narrows shared-table records after checking the polymorphic owner discriminator.
 * @param key - Credential loaded from the shared table.
 * @param kind - Expected owning identity kind.
 * @internal
 */
export function assertApiKeyOwner<
  Key extends ApiKeyMetadata,
  Kind extends keyof OwnerViews,
>(key: Key, kind: Kind): asserts key is Key & Omit<OwnerViews[Kind], "key"> {
  if (key.ownerType !== kind) {
    throw new Error("Invalid API-key owner");
  }
}
