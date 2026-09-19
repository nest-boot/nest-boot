import {
  AbilityBuilder,
  type AbilityTuple,
  type MongoQuery,
  type RawRuleFrom,
  type SubjectType,
} from "@casl/ability";

import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import type { AuthModuleUserOptions } from "../interfaces/auth-module-user-options.interface.js";
import type { AuthModuleWorkspaceOptions } from "../interfaces/auth-module-workspace-options.interface.js";
import { DEFAULT_USER_PERMISSIONS } from "../user.constants.js";
import { extendAbility } from "../utils/extend-ability.util.js";
import { resolveAuthCatalog } from "../utils/resolve-auth-catalog.util.js";
import { DEFAULT_WORKSPACE_PERMISSIONS } from "../workspace.constants.js";

/** Owns built-in permission mappings and validates business extensions. @internal */
export class AuthAbilityFactory {
  /** Builds auth rules and restricted extensions from already credential-limited permissions. */
  static createUserAbility(
    permissions: readonly string[],
    user: User,
    options: AuthModuleUserOptions = {},
  ): UserAbility {
    const grants = Object.freeze([...permissions]);
    const builder = new AbilityBuilder(UserAbility);
    // Services additionally enforce ownership for these self-service operations.
    builder.can(["read", "create"], Workspace);
    builder.can(["read", "update"], Invitation);
    builder.can(["read", "update"], Member);
    const subjects = { user: User, session: Session, "api-key": UserApiKey };
    for (const permission of DEFAULT_USER_PERMISSIONS) {
      if (!grants.includes(permission)) continue;
      const [resource, action] = permission.split(":");
      builder.can(action, subjects[resource as keyof typeof subjects]);
      if (permission === "user:get" || permission === "user:list")
        builder.can("read", User);
    }
    const configure:
      | ((
          ...args: Parameters<NonNullable<typeof options.buildAbility>>
        ) => unknown)
      | undefined = options.buildAbility;
    if (configure)
      extendAbility(
        builder,
        grants,
        resolveAuthCatalog({ user: options }, "user").permissions,
        (rules) => configure(rules, grants, user),
      );
    this.addSubjectAliases(builder.rules);
    return builder.build();
  }

  /** Builds auth rules and restricted extensions from already credential-limited permissions. */
  static createWorkspaceAbility(
    permissions: readonly string[],
    workspace: Workspace,
    options: AuthModuleWorkspaceOptions = {},
  ): WorkspaceAbility {
    const grants = Object.freeze([...permissions]);
    const builder = new AbilityBuilder(WorkspaceAbility);
    builder.can("read", Workspace);
    builder.can("read", Invitation);
    builder.can("read", Member);
    const subjects = {
      workspace: Workspace,
      member: Member,
      invitation: Invitation,
      "api-key": WorkspaceApiKey,
    };
    for (const permission of DEFAULT_WORKSPACE_PERMISSIONS) {
      if (!grants.includes(permission)) continue;
      const [resource, action] = permission.split(":");
      builder.can(action, subjects[resource as keyof typeof subjects]);
    }
    const configure:
      | ((
          ...args: Parameters<NonNullable<typeof options.buildAbility>>
        ) => unknown)
      | undefined = options.buildAbility;
    if (configure)
      extendAbility(
        builder,
        grants,
        resolveAuthCatalog({ workspace: options }, "workspace").permissions,
        (rules) => configure(rules, grants, workspace),
      );
    this.addSubjectAliases(builder.rules);
    return builder.build();
  }

  /** Keeps class checks, tagged objects, and serialized frontend names equivalent. */
  private static addSubjectAliases(
    rules: RawRuleFrom<AbilityTuple, MongoQuery>[],
  ): void {
    const classes = new Map<string, SubjectType>();
    for (const rule of rules) {
      for (const target of Array.isArray(rule.subject)
        ? rule.subject
        : [rule.subject]) {
        if (typeof target === "function") classes.set(target.name, target);
      }
    }
    for (const rule of rules) {
      const targets = Array.isArray(rule.subject)
        ? rule.subject
        : [rule.subject];
      rule.subject = [
        ...new Set(
          targets.flatMap((target) => {
            if (typeof target === "function") return [target, target.name];
            const constructor = classes.get(target);
            return constructor ? [constructor, target] : [target];
          }),
        ),
      ];
    }
  }
}
