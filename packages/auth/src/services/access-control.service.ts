import type { Subject } from "@casl/ability";
import { Reference } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";

import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { MODULE_OPTIONS_TOKEN } from "../auth.module-definition.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Member } from "../entities/member.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import type { ApiKey } from "../types/api-key.type.js";
import { DEFAULT_USER_ROLE, DEFAULT_USER_ROLES } from "../user.constants.js";
import { resolveAuthPermissions } from "../utils/auth-role.util.js";
import { getCurrentApiKey } from "../utils/get-current-api-key.util.js";
import {
  DEFAULT_WORKSPACE_ROLE,
  DEFAULT_WORKSPACE_ROLES,
} from "../workspace.constants.js";

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

    const user = RequestContext.get(User);
    const apiKey = getCurrentApiKey();
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

    const apiKey = getCurrentApiKey();
    const workspaceApiKey = apiKey && this.isWorkspaceApiKey(apiKey);
    const member = RequestContext.get(Member);
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
  assertCurrentUser(user: User): void {
    const currentUser = RequestContext.isActive()
      ? RequestContext.get(User)
      : undefined;

    if (!currentUser || String(currentUser.id) !== String(user.id)) {
      throw new ForbiddenException("The operation belongs to another user");
    }
  }

  /** Throws unless the supplied session is the authenticated session. */
  assertCurrentSession(session: Session): void {
    const currentSession = RequestContext.isActive()
      ? RequestContext.get(Session)
      : undefined;

    if (currentSession?.token !== session.token) {
      throw new ForbiddenException("The operation belongs to another session");
    }
  }

  /** Throws unless the supplied workspace is selected for the current request. */
  assertCurrentWorkspace(workspace: Workspace): void {
    const currentWorkspace = RequestContext.isActive()
      ? RequestContext.get(Workspace)
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
  assertCurrentMember(member: Member | null | undefined): void {
    const currentMember = RequestContext.isActive()
      ? RequestContext.get(Member)
      : undefined;

    if (
      !member ||
      !currentMember ||
      String(currentMember.id) !== String(member.id)
    ) {
      throw new ForbiddenException(
        "The operation belongs to another workspace member",
      );
    }
  }

  /** Throws when a user grant exceeds the current principal's permissions. */
  assertCanGrantUserPermissions(requestedPermissions: readonly string[]): void {
    const allowed = new Set(this.getUserGrantPermissions());
    const excessive = requestedPermissions.filter(
      (permission) => !allowed.has(permission),
    );
    if (excessive.length > 0) {
      throw new ForbiddenException(
        `User permissions exceed issuer permissions: ${excessive.join(", ")}`,
      );
    }
  }

  /** Checks the same grant ceiling used when assigning user permissions. */
  canGrantUserPermissions(requestedPermissions: readonly string[]): boolean {
    const allowed = new Set(this.getUserGrantPermissions());
    return requestedPermissions.every((permission) => allowed.has(permission));
  }

  private getUserGrantPermissions(): readonly string[] {
    const user = RequestContext.isActive() ? RequestContext.get(User) : null;
    const apiKey = RequestContext.isActive() ? getCurrentApiKey() : null;
    let permissions =
      user && !(apiKey && this.isWorkspaceApiKey(apiKey))
        ? resolveAuthPermissions(
            user.roles ?? [this.options.user?.defaultRole ?? DEFAULT_USER_ROLE],
            user.permissions ?? [],
            this.options.user?.roles ?? DEFAULT_USER_ROLES,
          )
        : [];
    if (apiKey) {
      const allowed = new Set(apiKey.permissions ?? []);
      permissions = permissions.filter((permission) => allowed.has(permission));
    }
    return permissions;
  }

  /** Throws when a workspace grant exceeds the current principal's permissions. */
  assertCanGrantWorkspacePermissions(
    requestedPermissions: readonly string[],
  ): void {
    const allowed = new Set(this.getWorkspaceGrantPermissions());
    const excessive = requestedPermissions.filter(
      (permission) => !allowed.has(permission),
    );
    if (excessive.length > 0) {
      throw new ForbiddenException(
        `Workspace permissions exceed issuer permissions: ${excessive.join(", ")}`,
      );
    }
  }

  /** Checks the same grant ceiling used when assigning workspace permissions. */
  canGrantWorkspacePermissions(
    requestedPermissions: readonly string[],
  ): boolean {
    const allowed = new Set(this.getWorkspaceGrantPermissions());
    return requestedPermissions.every((permission) => allowed.has(permission));
  }

  private getWorkspaceGrantPermissions(): readonly string[] {
    const apiKey = RequestContext.isActive() ? getCurrentApiKey() : undefined;
    const member = RequestContext.isActive()
      ? RequestContext.get(Member)
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

    return effectivePermissions;
  }

  /** Rejects access to or delegation of credentials broader than the authenticating API key. */
  assertApiKeyPermissionCeiling(permissions: readonly string[]): void {
    const apiKey = RequestContext.isActive() ? getCurrentApiKey() : null;
    if (!apiKey) return;
    const allowed = new Set(apiKey.permissions ?? []);
    const excessive = permissions.filter(
      (permission) => !allowed.has(permission),
    );
    if (excessive.length > 0) {
      throw new ForbiddenException(
        `API key permissions exceed authenticating API key permissions: ${excessive.join(", ")}`,
      );
    }
  }

  /** Checks API-key ownership independently of the application's database policies. */
  assertApiKeyOwner(apiKey: ApiKey): void {
    const ownerReference =
      apiKey instanceof UserApiKey ? apiKey.user : apiKey.workspace;
    if (!ownerReference) {
      throw new ForbiddenException("API key owner is missing");
    }
    const owner = Reference.unwrapReference<User | Workspace>(ownerReference);
    if (owner instanceof User) {
      this.assertCurrentUser(owner);
      return;
    }
    if (!(owner instanceof Workspace)) {
      throw new ForbiddenException("Unknown API key owner");
    }
    this.assertCurrentWorkspace(owner);
    const currentKey = RequestContext.isActive() ? getCurrentApiKey() : null;
    if (currentKey instanceof WorkspaceApiKey) {
      if (String(currentKey.workspace?.id) !== String(owner.id)) {
        throw new ForbiddenException("API key belongs to another workspace");
      }
      return;
    }
    const member = RequestContext.isActive()
      ? RequestContext.get(Member)
      : null;
    if (
      member?.status !== "ACTIVE" ||
      String(member.workspace.id) !== String(owner.id)
    ) {
      throw new ForbiddenException("An active workspace member is required");
    }
  }

  private isWorkspaceApiKey(apiKey: ApiKey): boolean {
    return apiKey instanceof WorkspaceApiKey;
  }
}
