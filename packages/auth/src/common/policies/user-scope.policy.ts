import type { PolicyDef } from "@mikro-orm/core";

import type { ScopePolicyOptions } from "../interfaces/scope-policy-options.interface.js";
import { createScopePolicy } from "./create-scope-policy.js";

/**
 * Creates a native permissive RLS policy matching app.user.id.
 * Defaults to `type: "bigint"`, `property: "user"`, `command: "all"` for the
 * authenticated database role. Set command: "select" for read-only ownership.
 * Missing/empty session identifiers match no rows. The property must map to a
 * single column; type is the explicit SQL cast, not an inferred TypeScript type.
 * Compose in Entity.policies; no Filter or discovery hook is required.
 * @param options - Configuration for this operation.
 * @returns Native policy scoped to the current user identifier.
 */
export function userScopePolicy(options: ScopePolicyOptions = {}): PolicyDef {
  return createScopePolicy("user", options);
}
