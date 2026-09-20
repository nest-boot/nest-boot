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
import { ApiKeyLifecycle } from "../infrastructure/api-key-lifecycle.js";
import type { CreateApiKeyOptions } from "../interfaces/create-api-key-options.interface.js";
import type { CreatedApiKey } from "../interfaces/created-api-key.interface.js";
import type { UpdateApiKeyOptions } from "../interfaces/update-api-key-options.interface.js";
import type { WorkspaceApiKeyPermissionOption } from "../objects/workspace-api-key-permission-option.object.js";
import {
  generateApiKey,
  hashApiKey,
} from "../utils/api-key-credential.util.js";
import { resolveApiKeyPermissionCatalog } from "../utils/api-key-permissions.util.js";
import { normalizeAuthPermissions } from "../utils/auth-role.util.js";
import { getCurrentApiKey } from "../utils/get-current-api-key.util.js";
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
    const { permissions, allowed, defaults } = resolveApiKeyPermissionCatalog(
      this.authOptions,
      "workspace",
    );
    const allowedSet = new Set(allowed);
    return permissions.map((permission) => ({
      permission,
      default: defaults.includes(permission),
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
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<WorkspaceApiKey>(WorkspaceApiKeyConnection, args, {
      where,
      exclude: ["key"] as never,
    });
    // Reject the whole page rather than silently changing cursor pagination.
    for (const { node } of connection.edges) {
      this.accessControlService.assertWorkspaceCan("read", node);
    }
    return connection;
  }

  /** Creates an API key owned by a workspace. */
  async createWorkspaceApiKey(
    workspace: Workspace,
    options: CreateApiKeyOptions,
  ): Promise<CreatedApiKey<WorkspaceApiKey>> {
    this.assertWorkspacePrincipal(workspace);
    this.accessControlService.assertWorkspaceCan("write", WorkspaceApiKey);
    const permissions = this.normalizePermissions(
      options.permissions === undefined
        ? resolveApiKeyPermissionCatalog(this.authOptions, "workspace").defaults
        : (options.permissions ?? []),
    );
    this.accessControlService.assertCanGrantWorkspacePermissions(permissions);
    return await this.createKey(workspace, options, permissions);
  }

  /** Updates a key owned by the authenticated workspace. */
  async updateWorkspaceApiKey(
    id: string,
    input: UpdateApiKeyOptions,
  ): Promise<WorkspaceApiKey> {
    this.accessControlService.assertWorkspaceCan("write", WorkspaceApiKey);
    const apiKey = await this.findWritableApiKey(id);
    this.accessControlService.assertWorkspaceCan("write", apiKey);
    const permissions =
      input.permissions === undefined
        ? undefined
        : this.normalizePermissions(input.permissions ?? []);
    // Allow disabling stale grants without replacing them.
    if (input.enabled !== false || permissions !== undefined) {
      const finalPermissions =
        permissions ?? this.normalizePermissions(apiKey.permissions ?? []);
      this.accessControlService.assertCanGrantWorkspacePermissions(
        finalPermissions,
      );
    }
    return await ApiKeyLifecycle.update(
      this.em,
      this.authOptions,
      apiKey,
      input,
      permissions,
    );
  }

  /** Deletes a key owned by the authenticated workspace. */
  async deleteWorkspaceApiKey(id: string): Promise<WorkspaceApiKey> {
    this.accessControlService.assertWorkspaceCan("write", WorkspaceApiKey);
    const apiKey = await this.findWritableApiKey(id);
    this.accessControlService.assertWorkspaceCan("write", apiKey);
    return await ApiKeyLifecycle.delete(this.em, this.authOptions, apiKey);
  }

  private async createKey(
    owner: Workspace,
    options: CreateApiKeyOptions,
    permissions: string[],
  ): Promise<CreatedApiKey<WorkspaceApiKey>> {
    ApiKeyLifecycle.assertExpiration(options.expiresAt);
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
        this.accessControlService.assertWorkspaceCan("write", entity);
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
      this.accessControlService.assertApiKeyPermissionCeiling(
        apiKey.permissions ?? [],
      );
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
      workspace: owner,
      ...(ceiling !== null ? { permissions: { $contained: ceiling } } : {}),
    } as unknown as FilterQuery<WorkspaceApiKey>;
  }

  private assertWorkspacePrincipal(workspace: Workspace): void {
    this.accessControlService.assertCurrentWorkspace(workspace);
    const apiKey = getCurrentApiKey();
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

  private normalizePermissions(permissions: readonly string[]): string[] {
    const { permissions: availablePermissions, allowed } =
      resolveApiKeyPermissionCatalog(this.authOptions, "workspace");

    const normalizedPermissions = normalizeAuthPermissions(
      permissions,
      availablePermissions,
      "Workspace API key",
    );
    this.assertPermissionCeiling(
      normalizedPermissions,
      allowed,
      "API key permissions exceed configured allowedPermissions",
    );
    return normalizedPermissions;
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
