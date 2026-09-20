import {
  AbilityBuilder,
  type AbilityTuple,
  type MongoQuery,
  type RawRuleFrom,
  type SubjectType,
} from "@casl/ability";

import { AuthAbility } from "../abilities/auth.ability.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import type { AbilityContext } from "../interfaces/ability-context.interface.js";
import { DEFAULT_USER_PERMISSIONS } from "../user.constants.js";
import { extendAbility } from "../utils/extend-ability.util.js";
import { resolveAuthCatalog } from "../utils/resolve-auth-catalog.util.js";
import { DEFAULT_WORKSPACE_PERMISSIONS } from "../workspace.constants.js";

/** Owns built-in permission mappings and validates business extensions. @internal */
export class AuthAbilityFactory {
  /** Builds auth rules and restricted extensions from already credential-limited permissions. */
  static createAbility(
    context: AbilityContext,
    options: AuthModuleOptions = {},
  ): AuthAbility {
    const snapshot = Object.freeze({
      ...context,
      userPermissions: Object.freeze(
        context.user ? [...context.userPermissions] : [],
      ),
      workspacePermissions: Object.freeze(
        context.workspace ? [...context.workspacePermissions] : [],
      ),
    });
    const builder = new AbilityBuilder(AuthAbility);
    // Self-service operations are authorized explicitly by their Services.
    const subjects = {
      user: User,
      session: Session,
      "user-api-key": UserApiKey,
      workspace: Workspace,
    };
    for (const permission of DEFAULT_USER_PERMISSIONS) {
      if (!snapshot.userPermissions.includes(permission)) continue;
      const [resource, action] = permission.split(":");
      builder.can(action, subjects[resource as keyof typeof subjects]);
    }
    const workspaceSubjects = {
      workspace: Workspace,
      member: Member,
      "workspace-api-key": WorkspaceApiKey,
    };
    for (const permission of DEFAULT_WORKSPACE_PERMISSIONS) {
      if (
        !snapshot.workspace ||
        !snapshot.workspacePermissions.includes(permission)
      )
        continue;
      // Invitation management is one member permission; keep entity checks for CASL conditions.
      if (permission === "member:invite") {
        builder.can(["read", "write"], Invitation, {
          workspaceId: snapshot.workspace.id,
        });
        continue;
      }
      const [resource, action] = permission.split(":");
      const conditions: MongoQuery =
        resource === "workspace"
          ? { id: snapshot.workspace.id }
          : { workspaceId: snapshot.workspace.id };
      builder.can(
        action,
        workspaceSubjects[
          resource as keyof typeof workspaceSubjects
        ] as SubjectType,
        conditions,
      );
    }
    const configure:
      | ((
          ...args: Parameters<NonNullable<typeof options.buildAbility>>
        ) => unknown)
      | undefined = options.buildAbility;
    if (configure)
      extendAbility(
        builder,
        snapshot,
        {
          user: resolveAuthCatalog(options, "user").permissions,
          workspace: resolveAuthCatalog(options, "workspace").permissions,
        },
        (rules) => configure(rules, snapshot),
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
