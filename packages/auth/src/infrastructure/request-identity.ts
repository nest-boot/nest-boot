import type { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { BadRequestException, ForbiddenException } from "@nestjs/common";

import { AuthAbility } from "../auth.ability.js";
import { API_KEY } from "../auth.constants.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { Member } from "../entities/member.entity.js";
import { MemberApiKey } from "../entities/member-api-key.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import type { RequestIdentityPatch } from "../interfaces/request-identity-patch.interface.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";
import { buildRequestAbility } from "../utils/build-request-ability.util.js";
import { getCurrentApiKey } from "../utils/get-current-api-key.util.js";
import { resolveRequestMember } from "../utils/resolve-request-member.util.js";
import { invalidateRequestPermissions } from "../utils/resolve-request-permissions.util.js";

/**
 * Owns request identity publication, authorization invalidation, and database scope.
 * @internal
 */
export class RequestIdentity {
  /**
   * Returns the active request member, rejecting user API keys outside their membership.
   * @returns Active member in the selected workspace, or null if unavailable.
   */
  static getCurrentMember(): Member | null {
    const member = resolveRequestMember();
    if (getCurrentApiKey() && RequestContext.get(User) && !member) {
      throw new ForbiddenException(
        "The API key owner is not a member of this workspace",
      );
    }
    return member;
  }

  /**
   * Throws unless the supplied user is the authenticated user.
   * @param user - The user whose account is being accessed.
   */
  static assertCurrentUser(user: User): void {
    const currentUser = RequestContext.isActive()
      ? RequestContext.get(User)
      : undefined;

    if (!currentUser || String(currentUser.id) !== String(user.id)) {
      throw new ForbiddenException("The operation belongs to another user");
    }
  }

  /**
   * Authorizes an explicit self-service path without granting a general resource ability.
   * @param user - The user whose account is being accessed.
   */
  static assertUserSession(user: User): void {
    this.assertCurrentUser(user);
    if (getCurrentApiKey()) {
      throw new ForbiddenException(
        "This self-service operation requires a user session",
      );
    }
  }

  /**
   * Throws unless the supplied session is the authenticated session.
   * @param session - Session whose metadata is being accessed.
   */
  static assertCurrentSession(session: Session): void {
    const currentSession = RequestContext.isActive()
      ? RequestContext.get(Session)
      : undefined;

    if (currentSession?.token !== session.token) {
      throw new ForbiddenException("The operation belongs to another session");
    }
  }

  /**
   * Throws unless the supplied workspace is selected for the current request.
   * @param workspace - The workspace that scopes this operation.
   */
  static assertCurrentWorkspace(workspace: Workspace): void {
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

  /**
   * Throws unless the supplied member is the current workspace member.
   * @param member - The workspace membership to inspect or change.
   */
  static assertCurrentMember(member: Member | null | undefined): void {
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

  /**
   * Matches credentials by both table and ID.
   * @param apiKey - API key whose metadata is being accessed.
   * @returns Whether the key matches the credential authenticating this request.
   */
  static isCurrentApiKey(apiKey: ApiKeyMetadata): boolean {
    const current = getCurrentApiKey();
    return (
      !!current &&
      current.constructor === apiKey.constructor &&
      current.id === apiKey.id
    );
  }

  /**
   * Rejects publishing an authenticating credential before its outer transaction commits.
   * @param em - Entity manager used for persistence.
   * @param apiKey - API key whose metadata is being accessed.
   */
  static assertApiKeyCanCommit(
    em: EntityManager,
    apiKey: ApiKeyMetadata,
  ): void {
    if (this.isCurrentApiKey(apiKey) && em.isInTransaction()) {
      throw new BadRequestException(
        "Change the authenticating API key outside an active transaction",
      );
    }
  }

  /**
   * Publishes only changes to the user represented by this request.
   * @param em - Entity manager used for persistence.
   * @param options - Authentication module configuration.
   * @param user - The user whose account is being accessed.
   */
  static updateUser(
    em: EntityManager,
    options: AuthModuleOptions,
    user: User,
  ): void {
    if (!RequestContext.isActive() || RequestContext.get(User)?.id !== user.id)
      return;
    this.update(em, options, { user });
  }

  /**
   * Publishes only current membership changes, clearing departed workspace scope.
   * @param em - Entity manager used for persistence.
   * @param options - Authentication module configuration.
   * @param member - The workspace membership to inspect or change.
   */
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

  /**
   * Publishes committed credential changes or revokes the entire request.
   * @param em - Entity manager used for persistence.
   * @param options - Authentication module configuration.
   * @param apiKey - API key whose metadata is being accessed.
   * @param deleted - Whether the API key has been deleted.
   */
  static updateApiKey(
    em: EntityManager,
    options: AuthModuleOptions,
    apiKey: ApiKeyMetadata,
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

  /**
   * Prepares the request ability once, failing closed when configuration rejects.
   * @param options - Authentication module configuration.
   */
  static prepare(options: AuthModuleOptions): void {
    if (!RequestContext.isActive() || RequestContext.get(AuthAbility)) return;
    this.refresh(options);
  }

  /**
   * Stages identity while authentication is being resolved, before a guard can run.
   * @param patch - Identity fields to replace.
   */
  static stage(patch: RequestIdentityPatch): void {
    if (!RequestContext.isActive()) return;
    if ("user" in patch) RequestContext.set(User, patch.user ?? null);
    if ("member" in patch) RequestContext.set(Member, patch.member ?? null);
    if ("workspace" in patch)
      RequestContext.set(Workspace, patch.workspace ?? null);
    if ("session" in patch) RequestContext.set(Session, patch.session ?? null);
    if ("apiKey" in patch)
      RequestContext.set<ApiKeyMetadata | null>(API_KEY, patch.apiKey ?? null);
    invalidateRequestPermissions();
    RequestContext.set(AuthAbility, null);
  }

  /**
   * Rebuilds one ability, never retaining old grants on failure.
   * @param options - Authentication module configuration.
   */
  static refresh(options: AuthModuleOptions): void {
    if (!RequestContext.isActive()) return;
    invalidateRequestPermissions();
    RequestContext.set(AuthAbility, new AuthAbility());
    RequestContext.set(AuthAbility, buildRequestAbility(options));
  }

  /**
   * Publishes a committed identity change; failures revoke the request instead of retaining stale grants.
   * @param em - Entity manager used for persistence.
   * @param options - Authentication module configuration.
   * @param patch - Identity fields to replace.
   */
  static update(
    em: EntityManager,
    options: AuthModuleOptions,
    patch: RequestIdentityPatch,
  ): void {
    if (!RequestContext.isActive()) return;
    this.stage(patch);
    try {
      const currentScope = em.getSessionContext();
      const scope = this.databaseScope();
      // Compare with the published scope: ORM entities may already be mutated.
      if (
        currentScope &&
        (currentScope.role !== scope.role ||
          Object.entries(scope.variables).some(
            ([key, value]) => currentScope.variables?.[key] !== value,
          ))
      )
        em.setSessionContext(scope);
      this.refresh(options);
    } catch (error) {
      this.clear(em);
      throw error;
    }
  }

  /**
   * Removes all credentials without falling back to another authentication method.
   * @param em - Entity manager used for persistence.
   */
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
        variables: {
          "app.user.id": "",
          "app.workspace.id": "",
          "app.member.id": "",
        },
      });
  }

  /**
   * Revokes workspace rules and rebuilds the remaining user ability after a committed change.
   * @param em - Entity manager used for persistence.
   * @param options - Authentication module configuration.
   */
  static clearWorkspace(em: EntityManager, options: AuthModuleOptions): void {
    if (getCurrentApiKey() instanceof MemberApiKey) {
      this.clear(em);
      return;
    }
    this.update(em, options, { member: null, workspace: null });
  }

  /**
   * Synchronizes only identity values; database policies never receive application permissions.
   * @param em - Entity manager used for persistence.
   */
  static syncDatabase(em: EntityManager): void {
    em.setSessionContext(this.databaseScope());
  }

  private static databaseScope() {
    const user = RequestContext.get(User);
    const apiKey = getCurrentApiKey();
    const workspace = RequestContext.get(Workspace);
    const member = resolveRequestMember();
    const authenticated = Boolean(user ?? apiKey);
    return {
      role: authenticated ? "authenticated" : "anonymous",
      variables: {
        "app.user.id": user?.id ?? "",
        "app.workspace.id":
          !authenticated || member ? (workspace?.id ?? "") : "",
        "app.member.id": member?.id ?? "",
      },
    };
  }
}
