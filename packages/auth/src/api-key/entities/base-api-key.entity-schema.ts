import { EntitySchema } from "@mikro-orm/core";

import { User } from "../../core/entities/user.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { apiKeyOwnerPolicy } from "../policies/api-key-owner.policy.js";
import { BaseApiKey } from "./base-api-key.entity.js";
import { SystemAccount } from "./system-account.entity.js";

/** Explicit persistence settings for the enabled credential owners. */
export interface BaseApiKeySchemaOptions {
  user?: boolean;
  workspace?: boolean;
  system?: boolean;
}

/**
 * Defines only the owner mapping and policies that depend on enabled features.
 * @param options - Enabled owner targets.
 * @param options.user - Whether user credentials are enabled.
 * @param options.workspace - Whether member credentials are enabled.
 * @param options.system - Whether system credentials are enabled.
 * @returns Abstract native schema inherited by the decorated ApiKey entity.
 */
export function createBaseApiKeySchema({
  user = true,
  workspace = true,
  system = true,
}: BaseApiKeySchemaOptions = {}) {
  const properties = {
    owner: {
      kind: "m:1" as const,
      entity: () => owners,
      ref: true,
      discriminator: "owner",
    },
  } as const;
  const owners = [
    ...(user ? [User] : []),
    ...(workspace ? [WorkspaceMember] : []),
    ...(system ? [SystemAccount] : []),
  ];
  const kinds = [
    ...(user ? ["user"] : []),
    ...(system ? ["system_account"] : []),
    ...(workspace ? ["workspace_member"] : []),
  ];
  if (!owners.length) {
    throw new Error("An API-key schema requires at least one enabled owner");
  }
  return new EntitySchema<Pick<BaseApiKey, "owner">>({
    class: BaseApiKey,
    abstract: true,
    policies: [apiKeyOwnerPolicy(workspace)],
    checks: [
      {
        name: "api_key_owner_type_check",
        expression: `"owner_type" in (${kinds.map((kind) => `'${kind}'`).join(", ")})`,
      },
    ],
    properties,
  });
}

/** Complete owner mapping for direct ORM consumers; register alongside ApiKey. */
export const BaseApiKeySchema = createBaseApiKeySchema();
