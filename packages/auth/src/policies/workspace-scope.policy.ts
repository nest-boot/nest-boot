import type { PolicyDef } from "@mikro-orm/core";

import type { ScopePolicyOptions } from "../interfaces/scope-policy-options.interface.js";
import { createScopePolicy } from "./create-scope-policy.js";

/**
 * Creates a native permissive RLS policy matching app.workspace.
 * Defaults to `type: "bigint"`, `property: "workspace"`, `command: "all"` for the
 * authenticated database role. Does not query the parent workspace or replace
 * service authorization. Missing/empty session identifiers match no rows.
 * Requires a single-column mapping and a matching explicit SQL type.
 * Compose in Entity.policies; no Filter or discovery hook is required.
 */
export function workspaceScopePolicy(
  options: ScopePolicyOptions = {},
): PolicyDef {
  return createScopePolicy("workspace", options);
}
