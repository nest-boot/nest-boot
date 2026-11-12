import { EntitySchema, t } from "@mikro-orm/core";

import { User } from "../../core/entities/user.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { apiKeyOwnerPolicy } from "../policies/api-key-owner.policy.js";
import { ApiKey } from "./api-key.entity.js";
import { SystemAccount } from "./system-account.entity.js";

/** Explicit persistence settings for the enabled credential owners. */
export interface ApiKeySchemaOptions {
  user?: boolean;
  workspace?: boolean;
  system?: boolean;
}

/**
 * Defines the shared credential table through MikroORM's public schema API.
 * @param options - Enabled owner targets.
 * @param options.user - Whether user credentials are enabled.
 * @param options.workspace - Whether member credentials are enabled.
 * @param options.system - Whether system credentials are enabled.
 * @returns Native schema bound to the ApiKey persistence class.
 */
export function createApiKeySchema({
  user = true,
  workspace = true,
  system = true,
}: ApiKeySchemaOptions = {}) {
  const properties = {
    id: { type: new t.bigint("string"), primary: true },
    name: { type: t.string },
    start: { type: t.string, nullable: true },
    prefix: { type: t.string, nullable: true },
    key: { type: t.text, unique: true },
    enabled: { type: t.boolean, default: true },
    permissions: { type: t.array, defaultRaw: "'{}'" },
    createdAt: { type: t.datetime, defaultRaw: "now()" },
    updatedAt: {
      type: t.datetime,
      defaultRaw: "now()",
      onUpdate: () => new Date(),
    },
    lastUsedAt: { type: t.datetime, nullable: true },
    expiresAt: { type: t.datetime, nullable: true },
    createdBy: {
      kind: "m:1" as const,
      entity: () => User,
      ref: true,
      nullable: true,
      deleteRule: "set null",
    },
    owner: {
      kind: "m:1" as const,
      entity: () => owners,
      ref: true,
      discriminator: "owner",
    },
    ownerType: {
      type: t.string,
      persist: false,
      fieldName: "owner_type",
      getter: true,
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
  return new EntitySchema<Pick<ApiKey, keyof typeof properties>>({
    class: ApiKey,
    policies: [apiKeyOwnerPolicy(workspace)],
    checks: [
      {
        name: "api_key_owner_type_check",
        expression: `"owner_type" in (${kinds.map((kind) => `'${kind}'`).join(", ")})`,
      },
    ],
    indexes: [
      { properties: ["owner"] },
      { properties: ["key"] },
      { properties: ["prefix"] },
      { properties: ["createdAt"] },
    ],
    properties,
  });
}

/** Complete native schema for direct ORM consumers. AuthModule constructs a feature-specific schema. */
export const ApiKeySchema = createApiKeySchema();
