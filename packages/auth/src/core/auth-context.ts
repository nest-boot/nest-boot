import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { Inject, Injectable } from "@nestjs/common";

import type { ApiKeyObject } from "../api-key/objects/api-key.object.js";
import { getCurrentApiKey } from "../api-key/utils/get-current-api-key.util.js";
import { AuthAbility } from "../common/auth.ability.js";
import { invalidateRequestPermissions } from "../common/utils/resolve-request-permissions.util.js";
import { Workspace } from "../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../workspace/entities/workspace-member.entity.js";
import { resolveAuthWorkspace } from "../workspace/utils/resolve-auth-workspace.util.js";
import { resolveRequestWorkspaceMember } from "../workspace/utils/resolve-request-workspace-member.util.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import { API_KEY, AUTH_WORKSPACE } from "./constants/auth.constants.js";
import { Session } from "./entities/session.entity.js";
import { User } from "./entities/user.entity.js";
import type { AuthContextPatch } from "./interfaces/auth-context-patch.interface.js";
import type { AuthModuleOptions } from "./interfaces/auth-module-options.interface.js";
import { buildRequestAbility } from "./utils/build-request-ability.util.js";
import { clearAuthenticationContext } from "./utils/clear-authentication-context.util.js";

/** Request identity and its authorization/database projections. No request state lives on the singleton. */
@Injectable()
export class AuthContext {
  constructor(
    private readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN) private readonly options: AuthModuleOptions,
  ) {}

  get user(): User | null {
    return RequestContext.isActive()
      ? (RequestContext.get(User) ?? null)
      : null;
  }
  get member(): WorkspaceMember | null {
    return resolveRequestWorkspaceMember();
  }
  get selectedWorkspace(): Workspace | null {
    return RequestContext.isActive()
      ? (RequestContext.get(Workspace) ?? null)
      : null;
  }
  get apiKey(): ApiKeyObject | null {
    return getCurrentApiKey();
  }

  /**
   * Workspace scope established from the current identity and effective grants.
   * @returns Authenticated workspace, or null without effective workspace access.
   */
  get authWorkspace(): Workspace | null {
    return resolveAuthWorkspace(this.options);
  }

  /**
   * Initializes a fully resolved identity before request handling.
   * @param identity - Identity values to publish.
   */
  initialize(identity: AuthContextPatch): void {
    if (!RequestContext.isActive()) {
      return;
    }
    this.assign(identity);
    this.requestManager.setSessionContext(this.databaseScope());
    this.refresh();
  }

  /**
   * Updates authorization after the service has persisted its changes.
   * @param identity - Identity values to publish.
   */
  set(identity: AuthContextPatch): void {
    if (!RequestContext.isActive()) {
      return;
    }
    this.assign(identity);
    try {
      const current = this.requestManager.getSessionContext();
      const scope = this.databaseScope();
      if (
        current &&
        (current.role !== scope.role ||
          Object.entries(scope.variables).some(
            ([key, value]) => current.variables?.[key] !== value,
          ))
      ) {
        this.requestManager.setSessionContext(scope);
      }
      this.refresh();
    } catch (error) {
      this.clear();
      throw error;
    }
  }

  clear(): void {
    if (RequestContext.isActive()) {
      clearAuthenticationContext(this.requestManager);
    }
  }

  /** Clears a deleted target and its associated authenticated membership. */
  clearWorkspace(): void {
    if (!RequestContext.isActive()) {
      return;
    }
    RequestContext.set(Workspace, null);
    this.clearWorkspaceMember();
  }

  /** Revokes membership without changing the independently selected target. */
  clearWorkspaceMember(): void {
    if (this.apiKey?.ownerType === "workspace_member") {
      this.clear();
    } else {
      this.set({ member: null });
    }
  }

  getAbility(): AuthAbility | undefined {
    if (!RequestContext.isActive()) {
      return;
    }
    if (!RequestContext.get(AuthAbility)) {
      this.refresh();
    }
    return RequestContext.get(AuthAbility);
  }

  refresh(): void {
    if (!RequestContext.isActive()) {
      return;
    }
    invalidateRequestPermissions();
    RequestContext.set(AUTH_WORKSPACE, this.authWorkspace);
    RequestContext.set(AuthAbility, new AuthAbility());
    RequestContext.set(AuthAbility, buildRequestAbility(this.options));
  }

  private get requestManager(): EntityManager {
    return RequestContext.isActive()
      ? (RequestContext.get(EntityManager) ?? this.em)
      : this.em;
  }

  private assign(patch: AuthContextPatch): void {
    if (!RequestContext.isActive()) {
      return;
    }
    if ("user" in patch) {
      RequestContext.set(User, patch.user ?? null);
    }
    if ("member" in patch) {
      RequestContext.set(WorkspaceMember, patch.member ?? null);
    }
    if ("workspace" in patch) {
      RequestContext.set(Workspace, patch.workspace ?? null);
    }
    if ("session" in patch) {
      RequestContext.set(Session, patch.session ?? null);
    }
    if ("apiKey" in patch) {
      RequestContext.set(API_KEY, patch.apiKey ?? null);
    }
    invalidateRequestPermissions();
    RequestContext.set(AuthAbility, null);
  }

  private databaseScope() {
    const user = this.user;
    const apiKey = this.apiKey;
    const workspace = this.selectedWorkspace;
    const member = resolveRequestWorkspaceMember();
    const authenticated = Boolean(user ?? apiKey);
    return {
      role: authenticated ? "authenticated" : "anonymous",
      variables: {
        "app.auth.user.id": user?.id ?? "",
        "app.auth.workspace.id": this.authWorkspace?.id ?? "",
        "app.selected.workspace.id": workspace?.id ?? "",
        "app.auth.workspace_member.id": member?.id ?? "",
      },
    };
  }
}
