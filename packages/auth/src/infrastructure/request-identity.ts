import type { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { BadRequestException } from "@nestjs/common";

import { AuthAbility } from "../abilities/auth.ability.js";
import { API_KEY } from "../auth.constants.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Member } from "../entities/member.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import type { RequestIdentityPatch } from "../interfaces/request-identity-patch.interface.js";
import type { ApiKey } from "../types/api-key.type.js";
import { buildRequestAbility } from "../utils/build-request-ability.util.js";
import { getCurrentApiKey } from "../utils/get-current-api-key.util.js";
import { invalidateRequestPermissions } from "../utils/resolve-request-permissions.util.js";

/** Owns request identity publication, authorization invalidation, and database scope. @internal */
export class RequestIdentity {
  /** Matches credentials by both table and ID. */
  static isCurrentApiKey(apiKey: ApiKey): boolean {
    const current = getCurrentApiKey();
    return (
      !!current &&
      current.constructor === apiKey.constructor &&
      current.id === apiKey.id
    );
  }

  /** Rejects publishing an authenticating credential before its outer transaction commits. */
  static assertApiKeyCanCommit(em: EntityManager, apiKey: ApiKey): void {
    if (this.isCurrentApiKey(apiKey) && em.isInTransaction()) {
      throw new BadRequestException(
        "Change the authenticating API key outside an active transaction",
      );
    }
  }

  /** Publishes only changes to the user represented by this request. */
  static updateUser(
    em: EntityManager,
    options: AuthModuleOptions,
    user: User,
  ): void {
    if (!RequestContext.isActive() || RequestContext.get(User)?.id !== user.id)
      return;
    this.update(em, options, { user });
  }

  /** Publishes only current membership changes, clearing departed workspace scope. */
  static updateMember(
    em: EntityManager,
    options: AuthModuleOptions,
    member: Member,
  ): void {
    if (
      !RequestContext.isActive() ||
      RequestContext.get(Member)?.id !== member.id
    )
      return;
    if (member.status !== "ACTIVE") this.clearWorkspace(em, options);
    else this.update(em, options, { member });
  }

  /** Publishes committed credential changes or revokes the entire request. */
  static updateApiKey(
    em: EntityManager,
    options: AuthModuleOptions,
    apiKey: ApiKey,
    deleted = false,
  ): void {
    if (!this.isCurrentApiKey(apiKey)) return;
    if (
      deleted ||
      !apiKey.enabled ||
      (apiKey.expiresAt && apiKey.expiresAt <= new Date())
    )
      this.clear(em);
    else this.update(em, options, { apiKey });
  }

  /** Prepares the request ability once, failing closed when configuration rejects. */
  static prepare(options: AuthModuleOptions): void {
    if (!RequestContext.isActive() || RequestContext.get(AuthAbility)) return;
    this.refresh(options);
  }

  /** Stages identity while authentication is being resolved, before a guard can run. */
  static stage(patch: RequestIdentityPatch): void {
    if (!RequestContext.isActive()) return;
    if ("user" in patch) RequestContext.set(User, patch.user ?? null);
    if ("member" in patch) RequestContext.set(Member, patch.member ?? null);
    if ("workspace" in patch)
      RequestContext.set(Workspace, patch.workspace ?? null);
    if ("session" in patch) RequestContext.set(Session, patch.session ?? null);
    if ("apiKey" in patch)
      RequestContext.set<ApiKey | null>(API_KEY, patch.apiKey ?? null);
    invalidateRequestPermissions();
    RequestContext.set(AuthAbility, null);
  }

  /** Rebuilds one ability, never retaining old grants on failure. */
  static refresh(options: AuthModuleOptions): void {
    if (!RequestContext.isActive()) return;
    invalidateRequestPermissions();
    RequestContext.set(AuthAbility, new AuthAbility());
    RequestContext.set(AuthAbility, buildRequestAbility(options));
  }

  /** Publishes a committed identity change; failures revoke the request instead of retaining stale grants. */
  static update(
    em: EntityManager,
    options: AuthModuleOptions,
    patch: RequestIdentityPatch,
  ): void {
    if (!RequestContext.isActive()) return;
    const previousScope = JSON.stringify(this.databaseScope());
    this.stage(patch);
    try {
      if (
        em.getSessionContext() &&
        previousScope !== JSON.stringify(this.databaseScope())
      )
        this.syncDatabase(em);
      this.refresh(options);
    } catch (error) {
      this.clear(em);
      throw error;
    }
  }

  /** Removes all credentials without falling back to another authentication method. */
  static clear(em: EntityManager): void {
    this.stage({
      user: null,
      member: null,
      workspace: null,
      session: null,
      apiKey: null,
    });
    if (RequestContext.isActive()) {
      RequestContext.set(AuthAbility, new AuthAbility());
    }
    if (em.getSessionContext())
      em.setSessionContext({
        role: "anonymous",
        variables: { "app.user.id": "", "app.workspace.id": "" },
      });
  }

  /** Revokes workspace rules and rebuilds the remaining user ability after a committed change. */
  static clearWorkspace(em: EntityManager, options: AuthModuleOptions): void {
    if (getCurrentApiKey() instanceof WorkspaceApiKey) {
      this.clear(em);
      return;
    }
    this.update(em, options, { member: null, workspace: null });
  }

  /** Synchronizes only identity values; database policies never receive application permissions. */
  static syncDatabase(em: EntityManager): void {
    em.setSessionContext(this.databaseScope());
  }

  private static databaseScope() {
    const user = RequestContext.get(User);
    const apiKey = getCurrentApiKey();
    const workspace = RequestContext.get(Workspace);
    const member = RequestContext.get(Member);
    const authenticated = Boolean(user ?? apiKey);
    const canUseWorkspace = Boolean(member ?? (apiKey && !user));
    return {
      role: authenticated ? "authenticated" : "anonymous",
      variables: {
        "app.user.id": user?.id ?? "",
        "app.workspace.id":
          !authenticated || canUseWorkspace ? (workspace?.id ?? "") : "",
      },
    };
  }
}
