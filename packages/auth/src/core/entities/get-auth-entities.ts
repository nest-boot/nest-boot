import {
  EntitySchema,
  MetadataStorage,
  type Options,
  Utils,
} from "@mikro-orm/core";

import { ApiKey } from "../../api-key/entities/api-key.entity.js";
import { SystemAccount } from "../../api-key/entities/system-account.entity.js";
import {
  apiKeyCleanupTrigger,
  apiKeyOwnerTrigger,
} from "../../api-key/infrastructure/api-key-triggers.js";
import { apiKeyOwnerPolicy } from "../../api-key/policies/api-key-owner.policy.js";
import { Invitation } from "../../workspace/entities/invitation.entity.js";
import { Member } from "../../workspace/entities/member.entity.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import type { AuthModuleOptions } from "../interfaces/auth-module-options.interface.js";
import { resolveAuthFeatures } from "../utils/resolve-auth-features.util.js";
import { Account } from "./account.entity.js";
import { Session } from "./session.entity.js";
import { User } from "./user.entity.js";
import { Verification } from "./verification.entity.js";

/**
 * Returns isolated entity schemas for the enabled authentication features.
 * @param options - Authentication feature configuration.
 * @param schema - PostgreSQL schema containing the authentication tables.
 * @returns Classes and local schemas suitable for MikroORM runtime and migrations.
 */
export function getAuthEntities(
  options: Pick<AuthModuleOptions, "admin" | "workspace" | "apiKey"> = {},
  schema = "public",
): NonNullable<Options["entities"]> {
  const features = resolveAuthFeatures(options);
  const workspace = features.workspace;
  const local = <T extends object>(entity: new (...args: never[]) => T) => {
    const metadata = Object.values(MetadataStorage.getMetadata()).find(
      (meta) => meta.class === entity,
    );
    if (!metadata) {
      throw new Error(`Missing entity metadata: ${entity.name}`);
    }
    const definition = EntitySchema.fromMetadata<T>(
      Utils.copy(metadata, false),
    );
    definition.meta.schema = schema;
    return definition;
  };
  const owners = [
    ...(features.userApiKey ? [User] : []),
    ...(features.workspaceApiKey ? [Member] : []),
    ...(features.systemApiKey ? [SystemAccount] : []),
  ];
  const kinds = [
    ...(features.userApiKey ? ["user" as const] : []),
    ...(features.systemApiKey ? ["system_account" as const] : []),
    ...(features.workspaceApiKey ? ["member" as const] : []),
  ];
  const user = local(User);
  user.meta.triggers = [
    ...user.meta.triggers.filter(
      (trigger) => trigger.name !== "user_api_key_cleanup",
    ),
    ...(features.userApiKey ? [apiKeyCleanupTrigger("user", schema)] : []),
  ];
  const result: NonNullable<Options["entities"]> = [
    user,
    local(Account),
    local(Session),
    local(Verification),
  ];
  if (features.apiKey) {
    const apiKey = local(ApiKey);
    // The decorator type exposes a single-target callback, while discovery accepts a union.
    apiKey.meta.properties.owner.entity = (() =>
      owners) as unknown as typeof apiKey.meta.properties.owner.entity;
    apiKey.meta.properties.owner.type = owners
      .map((owner) => owner.name)
      .join(" | ");
    apiKey.meta.policies = [apiKeyOwnerPolicy(workspace, schema)];
    apiKey.meta.checks = [
      {
        name: "api_key_owner_type_check",
        expression: `"owner_type" in (${kinds.map((kind) => `'${kind}'`).join(", ")})`,
      },
    ];
    apiKey.meta.triggers = [apiKeyOwnerTrigger(workspace, schema, kinds)];
    result.push(apiKey);
  }
  if (features.systemAccount) {
    const system = local(SystemAccount);
    system.meta.triggers = features.systemApiKey
      ? [apiKeyCleanupTrigger("system_account", schema)]
      : [];
    result.push(system);
  }
  if (workspace) {
    const member = local(Member);
    member.meta.triggers = [
      ...member.meta.triggers.filter(
        (trigger) => trigger.name !== "member_api_key_cleanup",
      ),
      ...(features.workspaceApiKey
        ? [apiKeyCleanupTrigger("member", schema)]
        : []),
    ];
    result.push(local(Workspace), member, local(Invitation));
  }
  return result;
}
