import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { Inject, Injectable } from "@nestjs/common";

import type { ApiKeyObject } from "../api-key/objects/api-key.object.js";
import { getCurrentApiKey } from "../api-key/utils/get-current-api-key.util.js";
import { AuthAbility } from "../common/auth.ability.js";
import { invalidateRequestPermissions } from "../common/utils/resolve-request-permissions.util.js";
import { Workspace } from "../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../workspace/entities/workspace-member.entity.js";
import { resolveRequestWorkspaceMember } from "../workspace/utils/resolve-request-workspace-member.util.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import { AuthTransactionSubscriber } from "./auth-transaction.subscriber.js";
import { API_KEY } from "./constants/auth.constants.js";
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
    private readonly transactions: AuthTransactionSubscriber,
  ) {}

  get user(): User | null {
    return RequestContext.isActive()
      ? (RequestContext.get(User) ?? null)
      : null;
  }
  get member(): WorkspaceMember | null {
    return RequestContext.isActive()
      ? (RequestContext.get(WorkspaceMember) ?? null)
      : null;
  }
  get workspace(): Workspace | null {
    return RequestContext.isActive()
      ? (RequestContext.get(Workspace) ?? null)
      : null;
  }
  get apiKey(): ApiKeyObject | null {
    return getCurrentApiKey();
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
   * Updates authorization only after the surrounding transaction has committed.
   * @param identity - Identity values to publish.
   */
  set(identity: AuthContextPatch): void {
    this.transactions.afterCommit(() => {
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
        this.clearNow();
        throw error;
      }
    });
  }

  clear(): void {
    this.transactions.afterCommit(() => {
      this.clearNow();
    });
  }

  clearWorkspace(): void {
    if (this.apiKey?.ownerType === "workspace_member") {
      this.clear();
    } else {
      this.set({ member: null, workspace: null });
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
    RequestContext.set(AuthAbility, new AuthAbility());
    RequestContext.set(AuthAbility, buildRequestAbility(this.options));
  }

  private get requestManager(): EntityManager {
    return RequestContext.isActive()
      ? (RequestContext.get(EntityManager) ?? this.em)
      : this.em;
  }

  private clearNow(): void {
    clearAuthenticationContext(this.requestManager);
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
    const workspace = this.workspace;
    const member = resolveRequestWorkspaceMember();
    const authenticated = Boolean(user ?? apiKey);
    return {
      role: authenticated ? "authenticated" : "anonymous",
      variables: {
        "app.user.id": user?.id ?? "",
        "app.workspace.id":
          !authenticated || member ? (workspace?.id ?? "") : "",
        "app.system_account.id":
          apiKey?.ownerType === "system_account"
            ? (apiKey.systemAccount?.id ?? "")
            : "",
        "app.member.id": member?.id ?? "",
      },
    };
  }
}
