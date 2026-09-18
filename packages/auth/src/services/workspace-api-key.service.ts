import {
  EntityManager,
  type FilterQuery,
  Reference,
  type RequiredEntityData,
} from "@mikro-orm/core";
import type { SqlEntityManager } from "@mikro-orm/sql";
import {
  type ConnectionArgsInterface,
  type ConnectionInterface,
  ConnectionManager,
} from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { MODULE_OPTIONS_TOKEN } from "../auth.module-definition.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { WorkspaceApiKeyConnection } from "../connections/workspace-api-key.connection-definition.js";
import { Member } from "../entities/member.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
import type { CreateApiKeyOptions } from "../interfaces/create-api-key-options.interface.js";
import type { CreatedApiKey } from "../interfaces/created-api-key.interface.js";
import type { UpdateApiKeyOptions } from "../interfaces/update-api-key-options.interface.js";
import type { WorkspaceApiKeyPermissionOption } from "../objects/workspace-api-key-permission-option.object.js";
import type { ApiKey } from "../types/api-key.type.js";
import {
  generateApiKey,
  hashApiKey,
} from "../utils/api-key-credential.util.js";
import { resolveApiKeyPermissionCatalog } from "../utils/api-key-permissions.util.js";
import { normalizeAuthPermissions } from "../utils/auth-role.util.js";
import { getCurrentApiKey } from "../utils/get-current-api-key.util.js";
import { resolveAuthCatalog } from "../utils/resolve-auth-catalog.util.js";
import { AccessControlService } from "./access-control.service.js";

/** Manages workspace-owned API keys within the current request's authorization scope. */
@Injectable()
export class WorkspaceApiKeyService {
  private readonly logger = new Logger(WorkspaceApiKeyService.name);

  /** Creates an API-key domain service. */
  constructor(
    /** MikroORM entity manager used for API-key persistence. */
    protected readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
    private readonly accessControlService: AccessControlService,
  ) {}

  /** Lists API-key grants available to the caller in the selected workspace. */
  getWorkspaceApiKeyPermissions(
    workspace: Workspace,
  ): WorkspaceApiKeyPermissionOption[] {
    this.accessControlService.assertCurrentWorkspace(workspace);
    const { permissions, allowed } = resolveApiKeyPermissionCatalog(
      this.authOptions,
      "workspace",
    );
    const allowedSet = new Set(allowed);
    return permissions.map((permission) => ({
      permission,
      grantable:
        allowedSet.has(permission) &&
        this.accessControlService.canGrantWorkspacePermissions([permission]),
    }));
  }

  /** Returns a key owned by the authenticated workspace and within the caller's scope. */
  async getWorkspaceApiKey(
    id: string,
    workspace: Workspace,
  ): Promise<WorkspaceApiKey | null> {
    this.assertWorkspacePrincipal(workspace);
    this.accessControlService.assertWorkspaceCan("read", WorkspaceApiKey);
    const apiKey = await this.getVisibleApiKey(id, workspace);
    if (apiKey) {
      this.accessControlService.assertWorkspaceCan("read", apiKey);
    }
    return apiKey;
  }

  /** Paginates selected-workspace keys after applying ownership and permission ceilings. */
  async getWorkspaceApiKeyConnection(
    workspace: Workspace,
    args: ConnectionArgsInterface<WorkspaceApiKey>,
  ): Promise<ConnectionInterface<WorkspaceApiKey>> {
    this.assertWorkspacePrincipal(workspace);
    this.accessControlService.assertWorkspaceCan("read", WorkspaceApiKey);
    const where = this.getOwnedListFilter(workspace);
    return await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<WorkspaceApiKey>(WorkspaceApiKeyConnection, args, {
      where,
      exclude: ["key"] as never,
    });
  }

  /** Creates an API key owned by a workspace. */
  async createWorkspaceApiKey(
    workspace: Workspace,
    options: CreateApiKeyOptions,
  ): Promise<CreatedApiKey<WorkspaceApiKey>> {
    this.assertWorkspacePrincipal(workspace);
    this.accessControlService.assertWorkspaceCan("create", WorkspaceApiKey);
    const permissions = this.normalizeCreatePermissions(workspace, options);
    this.accessControlService.assertCanGrantWorkspacePermissions(permissions);
    return await this.createKey(workspace, options, permissions);
  }

  /** Updates a key owned by the authenticated workspace. */
  async updateWorkspaceApiKey(
    id: string,
    input: UpdateApiKeyOptions,
  ): Promise<WorkspaceApiKey> {
    this.accessControlService.assertWorkspaceCan("update", WorkspaceApiKey);
    const apiKey = await this.findWritableApiKey(id);
    this.accessControlService.assertWorkspaceCan("update", apiKey);
    const permissions = this.normalizeUpdatedPermissions(apiKey, input);
    // Allow disabling stale grants without replacing them.
    if (input.enabled !== false || permissions !== undefined) {
      const finalPermissions =
        permissions ??
        this.normalizePermissions(
          this.unwrapOwner(apiKey),
          apiKey.permissions ?? [],
        );
      this.accessControlService.assertCanGrantWorkspacePermissions(
        finalPermissions,
      );
    }
    return await this.updateKey(apiKey, input, permissions);
  }

  /** Deletes a key owned by the authenticated workspace. */
  async deleteWorkspaceApiKey(id: string): Promise<WorkspaceApiKey> {
    this.accessControlService.assertWorkspaceCan("delete", WorkspaceApiKey);
    const apiKey = await this.findWritableApiKey(id);
    this.accessControlService.assertWorkspaceCan("delete", apiKey);
    return await this.deleteKey(apiKey);
  }

  private async createKey(
    owner: Workspace,
    options: CreateApiKeyOptions,
    permissions: string[],
  ): Promise<CreatedApiKey<WorkspaceApiKey>> {
    if (options.expiresAt && options.expiresAt <= new Date()) {
      throw new BadRequestException("API key expiration must be in the future");
    }
    const prefix = options.prefix ?? process.env.API_KEY_PREFIX ?? "sk";
    const plaintextApiKey = generateApiKey(prefix);
    const entity = await this.em.transactional(
      async (em) => {
        const entity = em.create(WorkspaceApiKey, {
          enabled: true,
          expiresAt: options.expiresAt ?? null,
          key: hashApiKey(plaintextApiKey),
          name: options.name,
          workspace: owner,
          permissions,
          prefix,
          start: plaintextApiKey.slice(0, 8),
        } as RequiredEntityData<WorkspaceApiKey>);

        await em.persist(entity).flush();
        return entity;
      },
      { clear: true },
    );
    this.logger.log("API key created", {
      apiKeyId: entity.id,
      ownerId: owner.id,
      ownerType: "workspace",
    });
    return { apiKey: plaintextApiKey, entity };
  }

  private async updateKey(
    apiKey: WorkspaceApiKey,
    input: UpdateApiKeyOptions,
    permissions: string[] | undefined,
  ): Promise<WorkspaceApiKey> {
    if (input.expiresAt && input.expiresAt <= new Date()) {
      throw new BadRequestException("API key expiration must be in the future");
    }
    RequestIdentity.assertApiKeyCanCommit(this.em, apiKey);
    const previous = {
      name: apiKey.name,
      enabled: apiKey.enabled,
      expiresAt: apiKey.expiresAt,
      permissions: apiKey.permissions,
      lastUsedAt: apiKey.lastUsedAt,
    };
    if (input.name !== undefined) apiKey.name = input.name;
    if (input.enabled !== undefined) apiKey.enabled = input.enabled;
    if (input.expiresAt !== undefined) apiKey.expiresAt = input.expiresAt;
    if (permissions !== undefined) {
      apiKey.permissions = permissions;
    }
    // Commit the final use before revocation removes the interceptor's identity.
    if (input.enabled === false && RequestIdentity.isCurrentApiKey(apiKey))
      apiKey.lastUsedAt = new Date();
    try {
      await this.em.persist(apiKey).flush();
    } catch (error) {
      Object.assign(apiKey, previous);
      throw error;
    }
    RequestIdentity.updateApiKey(this.em, this.authOptions, apiKey);
    return apiKey;
  }

  private async deleteKey(apiKey: WorkspaceApiKey): Promise<WorkspaceApiKey> {
    RequestIdentity.assertApiKeyCanCommit(this.em, apiKey);
    await this.em.remove(apiKey).flush();
    RequestIdentity.updateApiKey(this.em, this.authOptions, apiKey, true);
    return apiKey;
  }

  private async getVisibleApiKey(
    id: string,
    owner: Workspace,
  ): Promise<WorkspaceApiKey | null> {
    const apiKey = await this.em.findOne(
      WorkspaceApiKey,
      {
        $and: [{ id }, this.getOwnedListFilter(owner)],
      } as FilterQuery<WorkspaceApiKey>,
      { populate: ["workspace"] as never, exclude: ["key"] as never },
    );
    if (apiKey) {
      this.assertOwner(apiKey, owner);
      this.assertDelegatedApiKeyPermissionCeiling(apiKey.permissions ?? []);
    }
    return apiKey;
  }

  private async findWritableApiKey(id: string): Promise<WorkspaceApiKey> {
    const apiKey = await this.em.findOne(
      WorkspaceApiKey,
      { id } as FilterQuery<WorkspaceApiKey>,
      {
        populate: ["workspace"] as never,
        exclude: ["key"] as never,
        refresh: true,
      },
    );
    if (!apiKey) {
      throw new NotFoundException("API key not found");
    }
    this.accessControlService.assertApiKeyOwner(apiKey);
    this.accessControlService.assertApiKeyPermissionCeiling(
      apiKey.permissions ?? [],
    );
    return apiKey;
  }

  private getOwnedListFilter(owner: Workspace): FilterQuery<WorkspaceApiKey> {
    const ceiling = this.accessControlService.getApiKeyPermissionCeiling();
    return {
      ["workspace"]: owner,
      ...(ceiling !== null ? { permissions: { $contained: ceiling } } : {}),
    } as unknown as FilterQuery<WorkspaceApiKey>;
  }

  private assertWorkspacePrincipal(workspace: Workspace): void {
    this.accessControlService.assertCurrentWorkspace(workspace);
    const apiKey = this.getAuthenticatingApiKey();
    if (apiKey && apiKey instanceof WorkspaceApiKey) {
      this.assertOwner(apiKey, workspace);
      return;
    }
    const member = RequestContext.get(Member);
    if (member?.status !== "ACTIVE") {
      throw new ForbiddenException("An active workspace member is required");
    }
    this.accessControlService.assertCurrentMember(member);
    if (Reference.unwrapReference(member.workspace).id !== workspace.id) {
      throw new ForbiddenException(
        "Workspace member does not belong to this workspace",
      );
    }
  }

  private assertOwner(apiKey: WorkspaceApiKey, expectedOwner: Workspace): void {
    const owner = this.unwrapOwner(apiKey);
    if (owner.id !== expectedOwner.id) {
      throw new ForbiddenException(
        "You are not allowed to access this API key",
      );
    }
  }
  private unwrapOwner(apiKey: WorkspaceApiKey): Workspace {
    return Reference.unwrapReference(apiKey.workspace);
  }

  private normalizePermissions(
    owner: Workspace,
    permissions: readonly string[],
  ): string[] {
    // Invitations require a human sender; workspace keys have no user identity.
    if (permissions.includes("invitation:create")) {
      throw new BadRequestException(
        "Workspace API keys cannot grant invitation:create; use a user API key",
      );
    }
    const workspacePermissions = resolveAuthCatalog(
      this.authOptions,
      "workspace",
    ).permissions;
    const availablePermissions = workspacePermissions;

    const normalizedPermissions = normalizeAuthPermissions(
      permissions,
      availablePermissions,
      "Workspace API key",
    );
    this.assertPermissionCeiling(
      normalizedPermissions,
      resolveApiKeyPermissionCatalog(this.authOptions, "workspace").allowed,
      "API key permissions exceed configured allowedPermissions",
    );
    return normalizedPermissions;
  }

  private normalizeCreatePermissions(
    owner: Workspace,
    options: CreateApiKeyOptions,
  ): string[] {
    return this.normalizePermissions(
      owner,
      options.permissions === undefined
        ? (this.authOptions.apiKey?.defaultPermissions ?? [])
        : (options.permissions ?? []),
    );
  }

  private normalizeUpdatedPermissions(
    apiKey: WorkspaceApiKey,
    input: UpdateApiKeyOptions,
  ): string[] | undefined {
    return input.permissions === undefined
      ? undefined
      : this.normalizePermissions(
          this.unwrapOwner(apiKey),
          input.permissions ?? [],
        );
  }

  private getAuthenticatingApiKey(): ApiKey | null {
    return getCurrentApiKey();
  }

  private assertDelegatedApiKeyPermissionCeiling(
    permissions: readonly string[],
  ): void {
    this.accessControlService.assertApiKeyPermissionCeiling(permissions);
  }

  private assertPermissionCeiling(
    requestedPermissions: readonly string[],
    effectivePermissions: readonly string[],
    message: string,
  ): void {
    const effectivePermissionSet = new Set(effectivePermissions);
    const excessivePermissions = requestedPermissions.filter(
      (permission) => !effectivePermissionSet.has(permission),
    );
    if (excessivePermissions.length > 0) {
      throw new ForbiddenException(
        `${message}: ${excessivePermissions.join(", ")}`,
      );
    }
  }
}
