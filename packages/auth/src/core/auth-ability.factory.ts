import {
  AbilityBuilder,
  type AbilityTuple,
  type MongoQuery,
  type RawRuleFrom,
  type SubjectType,
} from "@casl/ability";

import { SystemAccount } from "../api-key/entities/system-account.entity.js";
import { SystemApiKey } from "../api-key/objects/system-api-key.object.js";
import { UserApiKey } from "../api-key/objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../api-key/objects/workspace-api-key.object.js";
import { AuthAbility } from "../common/auth.ability.js";
import type { AbilityContext } from "../common/interfaces/ability-context.interface.js";
import { DEFAULT_WORKSPACE_PERMISSIONS } from "../workspace/constants/workspace.constants.js";
import { Workspace } from "../workspace/entities/workspace.entity.js";
import { WorkspaceInvitation } from "../workspace/entities/workspace-invitation.entity.js";
import { WorkspaceMember } from "../workspace/entities/workspace-member.entity.js";
import { WorkspaceMemberType } from "../workspace/enums/workspace-member-type.enum.js";
import { DEFAULT_USER_PERMISSIONS } from "./constants/user.constants.js";
import { Session } from "./entities/session.entity.js";
import { User } from "./entities/user.entity.js";
import type { AuthModuleOptions } from "./interfaces/auth-module-options.interface.js";
import { isAuthPermissionEnabled } from "./utils/resolve-auth-features.util.js";

/**
 * Builds one request ability from built-in mappings and native CASL application rules.
 * @param context - Identity and effective permission snapshot.
 * @param options - Authentication module configuration.
 * @returns Unified ability for the supplied identity and effective grants.
 */
export function createAuthAbility(
  context: Omit<AbilityContext, "permissions">,
  options: AuthModuleOptions = {},
): AuthAbility {
  const userPermissions = Object.freeze(
    context.user || context.systemAccount
      ? context.userPermissions.filter((permission) =>
          isAuthPermissionEnabled(
            options,
            "user",
            permission,
            !!context.systemAccount,
          ),
        )
      : [],
  );
  const workspacePermissions = Object.freeze(
    options.workspace?.enabled === true && context.workspace
      ? context.workspacePermissions.filter((permission) =>
          isAuthPermissionEnabled(options, "workspace", permission),
        )
      : [],
  );
  const snapshot: AbilityContext = {
    ...context,
    workspace: options.workspace?.enabled === true ? context.workspace : null,
    member: options.workspace?.enabled === true ? context.member : null,
    userPermissions,
    workspacePermissions,
    permissions: Object.freeze([
      ...new Set([...userPermissions, ...workspacePermissions]),
    ]),
  };
  const builder = new AbilityBuilder(AuthAbility);
  // Self-service operations are authorized explicitly by their Services.
  const subjects = {
    user: User,
    session: Session,
    "user-api-key": UserApiKey,
    workspace: Workspace,
    "system-account": SystemAccount,
    "system-account-api-key": SystemApiKey,
  };
  for (const permission of DEFAULT_USER_PERMISSIONS) {
    if (
      (permission.startsWith("workspace:") &&
        options.workspace?.enabled !== true) ||
      !snapshot.userPermissions.includes(permission)
    ) {
      continue;
    }
    const [resource, action] = permission.split(":");
    builder.can(action, subjects[resource as keyof typeof subjects]);
  }
  const workspaceSubjects = {
    workspace: Workspace,
    "workspace-member": WorkspaceMember,
    "workspace-service-account": WorkspaceMember,
    "workspace-api-key": WorkspaceApiKey,
  };
  for (const permission of DEFAULT_WORKSPACE_PERMISSIONS) {
    if (
      !snapshot.workspace ||
      !snapshot.workspacePermissions.includes(permission)
    ) {
      continue;
    }
    // WorkspaceInvitation management is one member permission; keep entity checks for CASL conditions.
    if (permission === "workspace-member:invite") {
      builder.can(["read", "write"], WorkspaceInvitation, {
        workspaceId: snapshot.workspace.id,
      });
      continue;
    }
    const [resource, action] = permission.split(":");
    const conditions: MongoQuery =
      resource === "workspace"
        ? { id: snapshot.workspace.id }
        : { workspaceId: snapshot.workspace.id };
    if (resource === "workspace-member") {
      conditions.type = WorkspaceMemberType.USER;
      if (
        ["set-roles", "set-permissions"].includes(action) &&
        snapshot.workspacePermissions.includes(
          "workspace-service-account:write",
        )
      ) {
        builder.can(action, WorkspaceMember, {
          workspaceId: snapshot.workspace.id,
          type: WorkspaceMemberType.SERVICE_ACCOUNT,
        });
      }
    } else if (resource === "workspace-service-account") {
      conditions.type = WorkspaceMemberType.SERVICE_ACCOUNT;
    }
    builder.can(
      action,
      workspaceSubjects[
        resource as keyof typeof workspaceSubjects
      ] as SubjectType,
      conditions,
    );
  }
  const configure = options.buildAbility;
  const result: unknown = configure?.(Object.freeze({ ...snapshot, builder }));
  if (
    result &&
    typeof result === "object" &&
    "then" in result &&
    typeof result.then === "function"
  ) {
    // Configuration must finish before the request ability is published.
    void Promise.resolve(result).catch(() => undefined);
    throw new TypeError("buildAbility must be synchronous");
  }
  // WorkspaceMembers may edit their profile but cannot change their own active state.
  // Apply after extensions so the same invariant reaches every consumer.
  if (snapshot.member && snapshot.workspace) {
    builder.cannot("write", WorkspaceMember, ["status"], {
      id: snapshot.member.id,
      workspaceId: snapshot.workspace.id,
    });
  }
  addSubjectAliases(builder.rules);
  return builder.build();
}

/**
 * Builds and normalizes authorization rules from an explicit identity snapshot.
 * @param rules - Authorization rules to normalize.
 */
function addSubjectAliases(
  rules: RawRuleFrom<AbilityTuple, MongoQuery>[],
): void {
  const classes = new Map<string, SubjectType>();
  for (const rule of rules) {
    for (const target of Array.isArray(rule.subject)
      ? rule.subject
      : [rule.subject]) {
      if (typeof target === "function") {
        classes.set(target.name, target);
      }
    }
  }
  for (const rule of rules) {
    const targets = Array.isArray(rule.subject) ? rule.subject : [rule.subject];
    rule.subject = [
      ...new Set(
        targets.flatMap((target) => {
          if (typeof target === "function") {
            return [target, target.name];
          }
          const constructor = classes.get(target);
          return constructor ? [constructor, target] : [target];
        }),
      ),
    ];
  }
}
