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
  BaseWorkspaceMember,
} from "./entities/index.js";

/** Enforces user and workspace permissions prepared for the current request. */
@Injectable()
export class AuthorizationService {
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

    return (
      !!ability &&
      ability.can(action, subject) &&
      this.apiKeyCan(apiKey, action, subject)
    );
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
    if (apiKey && this.isWorkspaceApiKey(apiKey)) {
      return this.apiKeyCan(apiKey, action, subject);
    }

    const member = RequestContext.get(BaseWorkspaceMember);
    if (!member) return false;

    const ability = RequestContext.get(WorkspaceAbility);

    return (
      !!ability &&
      ability.can(action, subject) &&
      this.apiKeyCan(apiKey, action, subject)
    );
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

  private apiKeyCan(
    apiKey: BaseApiKey | undefined,
    action: string,
    subject: Subject,
  ): boolean {
    if (!apiKey) return true;

    const resource = this.getPermissionResource(subject);
    return (
      !!resource &&
      Array.isArray(apiKey.permissions) &&
      apiKey.permissions.includes(`${resource}:${action}`)
    );
  }

  private isWorkspaceApiKey(apiKey: BaseApiKey): boolean {
    const owner = Reference.unwrapReference(apiKey.owner as never) as unknown;
    return owner instanceof this.options.entities.workspace;
  }

  private getPermissionResource(subject: Subject): string | null {
    const value = subject as unknown;
    let name: string | null = null;

    if (typeof value === "string") {
      name = value;
    } else if (typeof value === "function") {
      name = value.name;
    } else if (value && typeof value === "object") {
      name = value.constructor.name;
    }

    return name ? `${name[0].toLowerCase()}${name.slice(1)}` : null;
  }
}
