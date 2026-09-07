import type { Subject } from "@casl/ability";
import { Reference } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";

import { UserAbility } from "./abilities/user.ability.js";
import { WorkspaceAbility } from "./abilities/workspace.ability.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import {
  BaseApiKey,
  BaseSession,
  BaseUser,
  BaseWorkspace,
  BaseWorkspaceMember,
} from "./entities/index.js";
import { resolveAuthPermissions } from "./utils/auth-role.util.js";
import {
  DEFAULT_WORKSPACE_ROLE,
  DEFAULT_WORKSPACE_ROLES,
} from "./workspace.constants.js";

/** Enforces user and workspace permissions prepared for the current request. */
@Injectable()
export class AccessControlService {
  /** Creates the authorization service. */
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
  ) {}

  /** Returns whether the current principal may perform a user-scoped action. */
  userCan(action: string, subject: Subject): boolean {
    if (!RequestContext.isActive()) return false;

    const user = RequestContext.get(BaseUser);
    const apiKey = RequestContext.get(BaseApiKey);
    if (!user || (apiKey && this.isWorkspaceApiKey(apiKey))) return false;

    const ability = RequestContext.get(UserAbility);

    return !!ability && ability.can(action, subject);
  }

  /** Throws unless the current principal may perform a user-scoped action. */
  assertUserCan(action: string, subject: Subject): void {
    if (!this.userCan(action, subject)) {
      throw new ForbiddenException(
        `You are not allowed to ${action} this user-scoped resource`,
      );
    }
  }

  /** Returns whether the current principal may perform a workspace action. */
  workspaceCan(action: string, subject: Subject): boolean {
    if (!RequestContext.isActive()) return false;

    const apiKey = RequestContext.get(BaseApiKey);
    const workspaceApiKey = apiKey && this.isWorkspaceApiKey(apiKey);
    const member = RequestContext.get(BaseWorkspaceMember);
    if (!workspaceApiKey && !member) return false;

    const ability = RequestContext.get(WorkspaceAbility);

    return !!ability && ability.can(action, subject);
  }

  /** Throws unless the current principal may perform a workspace action. */
  assertWorkspaceCan(action: string, subject: Subject): void {
    if (!this.workspaceCan(action, subject)) {
      throw new ForbiddenException(
        `You are not allowed to ${action} this workspace resource`,
      );
    }
  }

  /** Throws unless the supplied user is the authenticated user. */
  assertCurrentUser(user: BaseUser): void {
    const currentUser = RequestContext.isActive()
      ? RequestContext.get(BaseUser)
      : undefined;

    if (!currentUser || String(currentUser.id) !== String(user.id)) {
      throw new ForbiddenException("The operation belongs to another user");
    }
  }

  /** Throws unless the supplied session is the authenticated session. */
  assertCurrentSession(session: BaseSession): void {
    const currentSession = RequestContext.isActive()
      ? RequestContext.get(BaseSession)
      : undefined;

    if (currentSession?.token !== session.token) {
      throw new ForbiddenException("The operation belongs to another session");
    }
  }

  /** Throws unless the supplied workspace is selected for the current request. */
  assertCurrentWorkspace(workspace: BaseWorkspace): void {
    const currentWorkspace = RequestContext.isActive()
      ? RequestContext.get(BaseWorkspace)
      : undefined;

    if (
      !currentWorkspace ||
      String(currentWorkspace.id) !== String(workspace.id)
    ) {
      throw new ForbiddenException(
        "The operation belongs to another workspace",
      );
    }
  }

  /** Throws unless the supplied member is the current workspace member. */
  assertCurrentWorkspaceMember(member: BaseWorkspaceMember): void {
    const currentMember = RequestContext.isActive()
      ? RequestContext.get(BaseWorkspaceMember)
      : undefined;

    if (!currentMember || String(currentMember.id) !== String(member.id)) {
      throw new ForbiddenException(
        "The operation belongs to another workspace member",
      );
    }
  }

  /** Throws when a workspace grant exceeds the current principal's permissions. */
  assertCanGrantWorkspacePermissions(
    requestedPermissions: readonly string[],
  ): void {
    const apiKey = RequestContext.isActive()
      ? RequestContext.get(BaseApiKey)
      : undefined;
    const member = RequestContext.isActive()
      ? RequestContext.get(BaseWorkspaceMember)
      : undefined;
    const workspaceApiKey = apiKey && this.isWorkspaceApiKey(apiKey);

    let effectivePermissions: readonly string[];
    if (workspaceApiKey) {
      effectivePermissions = apiKey.permissions ?? [];
    } else if (member) {
      effectivePermissions = resolveAuthPermissions(
        member.roles ?? [
          this.options.workspace?.defaultRole ?? DEFAULT_WORKSPACE_ROLE,
        ],
        member.permissions ?? [],
        this.options.workspace?.roles ?? DEFAULT_WORKSPACE_ROLES,
      );

      if (apiKey) {
        const apiKeyPermissions = new Set(apiKey.permissions ?? []);
        effectivePermissions = effectivePermissions.filter((permission) =>
          apiKeyPermissions.has(permission),
        );
      }
    } else {
      effectivePermissions = [];
    }

    const effectivePermissionSet = new Set(effectivePermissions);
    const excessivePermissions = requestedPermissions.filter(
      (permission) => !effectivePermissionSet.has(permission),
    );
    if (excessivePermissions.length > 0) {
      throw new ForbiddenException(
        `Workspace permissions exceed issuer permissions: ${excessivePermissions.join(", ")}`,
      );
    }
  }

  private isWorkspaceApiKey(apiKey: BaseApiKey): boolean {
    const owner = Reference.unwrapReference(apiKey.owner as never) as unknown;
    return owner instanceof this.options.entities.workspace;
  }
}
