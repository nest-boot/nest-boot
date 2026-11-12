import type { SystemApiKey } from "../objects/system-api-key.object.js";
import type { UserApiKey } from "../objects/user-api-key.object.js";
import type { WorkspaceApiKey } from "../objects/workspace-api-key.object.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";

interface OwnerViews {
  user: UserApiKey;
  workspace_member: WorkspaceApiKey;
  system_account: SystemApiKey;
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
