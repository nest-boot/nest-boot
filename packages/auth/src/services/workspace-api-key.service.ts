import { EntityManager, type FilterQuery, Reference } from "@mikro-orm/core";
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
import { RequestIdentity } from "../infrastructure/request-identity.js";
import type { CreateApiKeyOptions } from "../interfaces/create-api-key-options.interface.js";
import type { CreatedApiKey } from "../interfaces/created-api-key.interface.js";
import type { UpdateApiKeyOptions } from "../interfaces/update-api-key-options.interface.js";
import type { WorkspaceApiKeyPermissionOption } from "../objects/workspace-api-key-permission-option.object.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";
import {
  normalizeApiKeyPermissions,
  resolveApiKeyPermissionCatalog,
} from "../utils/api-key-permissions.util.js";
import { authorize } from "../utils/authorize.util.js";
import { getCurrentApiKey } from "../utils/get-current-api-key.util.js";
import {
  assertApiKeyPermissionCeiling,
  assertCanGrantPermissions,
  canGrantPermissions,
} from "../utils/permission-grants.util.js";
import { resolveRequestPermissions } from "../utils/resolve-request-permissions.util.js";

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
  ) {}

  /** Lists API-key grants available to the caller in the selected workspace. */
  getWorkspaceApiKeyPermissions(
    workspace: Workspace,
  ): WorkspaceApiKeyPermissionOption[] {
    RequestIdentity.assertCurrentWorkspace(workspace);
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
        canGrantPermissions(this.authOptions, "workspace", [permission]),
    }));
  }

  /** Returns a key owned by the authenticated workspace and within the caller's scope. */
  async getWorkspaceApiKey(
    id: string,
    workspace: Workspace,
  ): Promise<ApiKeyMetadata<WorkspaceApiKey> | null> {
    this.assertWorkspacePrincipal(workspace);
    authorize("read", WorkspaceApiKey);
    const apiKey = await this.getVisibleApiKey(id, workspace);
    if (apiKey) {
      authorize("read", apiKey);
    }
    return apiKey;
  }

  /** Paginates selected-workspace keys after applying ownership and permission ceilings. */
  async getWorkspaceApiKeyConnection(
    workspace: Workspace,
    args: ConnectionArgsInterface<WorkspaceApiKey>,
  ): Promise<ConnectionInterface<ApiKeyMetadata<WorkspaceApiKey>>> {
    this.assertWorkspacePrincipal(workspace);
    authorize("read", WorkspaceApiKey);
    const where = this.getOwnedListFilter(workspace);
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find(WorkspaceApiKeyConnection, args, {
      where,
      exclude: ["key"],
    });
    // Reject the whole page rather than silently changing cursor pagination.
    for (const { node } of connection.edges) {
      authorize("read", node);
    }
    return connection;
  }

  /** Creates an API key owned by a workspace. */
  async createWorkspaceApiKey(
    workspace: Workspace,
    options: CreateApiKeyOptions,
  ): Promise<CreatedApiKey<WorkspaceApiKey>> {
    this.assertWorkspacePrincipal(workspace);
    authorize("write", WorkspaceApiKey);
    const permissions = normalizeApiKeyPermissions(
      this.authOptions,
      "workspace",
      options.permissions,
    );
    assertCanGrantPermissions(this.authOptions, "workspace", permissions);
    return await this.createKey(workspace, options, permissions);
  }

  /** Updates a key owned by the authenticated workspace. */
  async updateWorkspaceApiKey(
    id: string,
    input: UpdateApiKeyOptions,
  ): Promise<ApiKeyMetadata<WorkspaceApiKey>> {
    authorize("write", WorkspaceApiKey);
    const apiKey = await this.findWritableApiKey(id);
    authorize("write", apiKey);
    const permissions =
      input.permissions === undefined
        ? undefined
        : normalizeApiKeyPermissions(
            this.authOptions,
            "workspace",
            input.permissions ?? [],
          );
    // Allow disabling stale grants without replacing them.
    if (input.enabled !== false || permissions !== undefined) {
      const finalPermissions =
        permissions ??
        normalizeApiKeyPermissions(
          this.authOptions,
          "workspace",
          apiKey.permissions ?? [],
        );
      assertCanGrantPermissions(
        this.authOptions,
        "workspace",
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
  async deleteWorkspaceApiKey(
    id: string,
  ): Promise<ApiKeyMetadata<WorkspaceApiKey>> {
    authorize("write", WorkspaceApiKey);
    const apiKey = await this.findWritableApiKey(id);
    authorize("write", apiKey);
    return await ApiKeyLifecycle.delete(this.em, this.authOptions, apiKey);
  }

  private async createKey(
    workspace: Workspace,
    options: CreateApiKeyOptions,
    permissions: string[],
  ): Promise<CreatedApiKey<WorkspaceApiKey>> {
    const { apiKey, data } = ApiKeyLifecycle.prepareCreation(
      options,
      permissions,
      this.authOptions.apiKey?.workspace?.defaultPrefix ??
        process.env.API_KEY_PREFIX ??
        "ws_",
    );
    const entity = await this.em.transactional(
      async (em) => {
        const entity = em.create(WorkspaceApiKey, {
          ...data,
          workspace,
        });
        authorize("write", entity);
        await em.persist(entity).flush();
        return entity;
      },
      { clear: true },
    );
    this.logger.log("API key created", {
      apiKeyId: entity.id,
      ownerId: workspace.id,
      ownerType: "workspace",
    });
    return { apiKey, entity };
  }

  private async getVisibleApiKey(
    id: string,
    workspace: Workspace,
  ): Promise<ApiKeyMetadata<WorkspaceApiKey> | null> {
    const apiKey = await this.em.findOne(
      WorkspaceApiKey,
      {
        $and: [{ id }, this.getOwnedListFilter(workspace)],
      },
      { populate: ["workspace"], exclude: ["key"] },
    );
    if (apiKey) {
      this.assertWorkspace(apiKey, workspace);
      assertApiKeyPermissionCeiling(this.authOptions, apiKey.permissions ?? []);
    }
    return apiKey;
  }

  private async findWritableApiKey(
    id: string,
  ): Promise<ApiKeyMetadata<WorkspaceApiKey>> {
    const apiKey = await this.em.findOne(
      WorkspaceApiKey,
      { id },
      {
        populate: ["workspace"],
        exclude: ["key"],
        refresh: true,
      },
    );
    if (!apiKey) {
      throw new NotFoundException("API key not found");
    }
    this.assertWorkspacePrincipal(this.unwrapWorkspace(apiKey));
    assertApiKeyPermissionCeiling(this.authOptions, apiKey.permissions ?? []);
    return apiKey;
  }

  private getOwnedListFilter(
    workspace: Workspace,
  ): FilterQuery<WorkspaceApiKey> {
    const ceiling = resolveRequestPermissions(this.authOptions).apiKey;
    return {
      workspace,
      ...(ceiling !== null ? { permissions: { $contained: ceiling } } : {}),
    };
  }

  private assertWorkspacePrincipal(workspace: Workspace): void {
    RequestIdentity.assertCurrentWorkspace(workspace);
    const apiKey = getCurrentApiKey();
    if (apiKey && apiKey instanceof WorkspaceApiKey) {
      this.assertWorkspace(apiKey, workspace);
      return;
    }
    const member = RequestContext.get(Member);
    if (member?.status !== "ACTIVE") {
      throw new ForbiddenException("An active workspace member is required");
    }
    RequestIdentity.assertCurrentMember(member);
    if (Reference.unwrapReference(member.workspace).id !== workspace.id) {
      throw new ForbiddenException(
        "Workspace member does not belong to this workspace",
      );
    }
  }

  private assertWorkspace(
    apiKey: ApiKeyMetadata<WorkspaceApiKey>,
    expectedWorkspace: Workspace,
  ): void {
    const workspace = this.unwrapWorkspace(apiKey);
    if (workspace.id !== expectedWorkspace.id) {
      throw new ForbiddenException(
        "You are not allowed to access this API key",
      );
    }
  }

  private unwrapWorkspace(apiKey: ApiKeyMetadata<WorkspaceApiKey>): Workspace {
    if (!apiKey.workspace)
      throw new ForbiddenException("API key owner is missing");
    return Reference.unwrapReference(apiKey.workspace);
  }
}
