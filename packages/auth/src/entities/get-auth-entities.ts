import {
  EntitySchema,
  MetadataStorage,
  type Options,
  Utils,
} from "@mikro-orm/core";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import {
  apiKeyCleanupTrigger,
  apiKeyOwnerTrigger,
} from "../infrastructure/api-key-triggers.js";
import { apiKeyOwnerPolicy } from "../policies/api-key-owner.policy.js";
import { Account } from "./account.entity.js";
import { ApiKeyEntity } from "./api-key.entity.js";
import { Invitation } from "./invitation.entity.js";
import { Member } from "./member.entity.js";
import { Session } from "./session.entity.js";
import { SystemAccount } from "./system-account.entity.js";
import { User } from "./user.entity.js";
import { Verification } from "./verification.entity.js";
import { Workspace } from "./workspace.entity.js";

/**
 * Returns isolated entity schemas for the enabled authentication features.
 * @param options - Authentication feature configuration.
 * @param schema - PostgreSQL schema containing the authentication tables.
 * @returns Classes and local schemas suitable for MikroORM runtime and migrations.
 */
export function getAuthEntities(
  options: Pick<AuthModuleOptions, "workspace"> = {},
  schema = "public",
): NonNullable<Options["entities"]> {
  const workspace = options.workspace?.enabled === true;
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
  const apiKey = local(ApiKeyEntity);
  // Discovery supports union targets; EntityProperty.entity still exposes a single-target callback type.
  apiKey.meta.properties.owner.entity = (() =>
    workspace
      ? [User, Member, SystemAccount]
      : [
          User,
          SystemAccount,
        ]) as unknown as typeof apiKey.meta.properties.owner.entity;
  apiKey.meta.properties.owner.type = workspace
    ? "User | Member | SystemAccount"
    : "User | SystemAccount";
  apiKey.meta.policies = [apiKeyOwnerPolicy(workspace, schema)];
  apiKey.meta.checks = [
    {
      name: "api_key_owner_type_check",
      expression: workspace
        ? `"owner_type" in ('user', 'member', 'system_account')`
        : `"owner_type" in ('user', 'system_account')`,
    },
  ];
  apiKey.meta.triggers = [apiKeyOwnerTrigger(workspace, schema)];
  const user = local(User);
  user.meta.triggers = [
    ...user.meta.triggers.filter(
      (trigger) => trigger.name !== "user_api_key_cleanup",
    ),
    apiKeyCleanupTrigger("user", schema),
  ];
  const system = local(SystemAccount);
  system.meta.triggers = [apiKeyCleanupTrigger("system_account", schema)];
  const result: NonNullable<Options["entities"]> = [
    user,
    local(Account),
    local(Session),
    local(Verification),
    apiKey,
    system,
  ];
  if (workspace) {
    const member = local(Member);
    member.meta.triggers = [
      ...member.meta.triggers.filter(
        (trigger) => trigger.name !== "member_api_key_cleanup",
      ),
      apiKeyCleanupTrigger("member", schema),
    ];
    result.push(local(Workspace), member, local(Invitation));
  }
  return result;
}
