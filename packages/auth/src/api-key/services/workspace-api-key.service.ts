import {
  EntityManager,
  type FilterObject,
  raw,
  Reference,
} from "@mikro-orm/core";
import type { SqlEntityManager } from "@mikro-orm/sql";
import {
  type ConnectionArgsInterface,
  ConnectionManager,
  type ConnectionResult,
} from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { GraphQLResolveInfo } from "graphql";

import { authorize } from "../../common/utils/authorize.util.js";
import {
  assertApiKeyPermissionCeiling,
  assertCanGrantPermissions,
  assertPermissionCeiling,
  canGrantPermissions,
} from "../../common/utils/permission-grants.util.js";
import { resolveWorkspaceMemberPermissions } from "../../common/utils/resolve-effective-permissions.util.js";
import { resolveRequestPermissions } from "../../common/utils/resolve-request-permissions.util.js";
import { MODULE_OPTIONS_TOKEN } from "../../core/auth.module-definition.js";
import { User } from "../../core/entities/user.entity.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import { RequestIdentity } from "../../core/request-identity.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { ApiKeyLifecycle } from "../api-key-lifecycle.js";
import { WorkspaceApiKeyConnection } from "../connections/workspace-api-key.connection-definition.js";
import { ApiKey } from "../entities/api-key.entity.js";
import type { CreateWorkspaceApiKeyOptions } from "../interfaces/create-workspace-api-key-options.interface.js";
import type { CreatedApiKey } from "../interfaces/created-api-key.interface.js";
import type { UpdateApiKeyOptions } from "../interfaces/update-api-key-options.interface.js";
import { WorkspaceApiKey } from "../objects/workspace-api-key.object.js";
import type { WorkspaceApiKeyPermissionOption } from "../objects/workspace-api-key-permission-option.object.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";
import {
  normalizeApiKeyPermissions,
  resolveApiKeyPermissionCatalog,
} from "../utils/api-key-permissions.util.js";
import { toApiKeyView } from "../utils/api-key-view.util.js";
import { assertApiKeyFeature } from "../utils/assert-api-key-feature.util.js";
import { assertApiKeyOwner } from "../utils/assert-api-key-owner.util.js";
import { getCurrentApiKey } from "../utils/get-current-api-key.util.js";

/** Manages member-owned, workspace-scoped API keys within the current request's authorization scope. */
@Injectable()
export class WorkspaceApiKeyService {
  private readonly logger = new Logger(WorkspaceApiKeyService.name);

  /**
   * Creates an API-key domain service.
   * @param em - Entity manager used for persistence.
   * @param authOptions - Authentication module configuration.
   */
  constructor(
    /** MikroORM entity manager used for API-key persistence. */
    protected readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
  ) {}

  /**
   * Lists API-key grants available to the caller in the selected workspace.
   * @param workspace - The workspace that scopes this operation.
   * @returns WorkspaceMember API key permission choices with defaults and grant availability.
   */
  getWorkspaceApiKeyPermissions(
    workspace: Workspace,
  ): WorkspaceApiKeyPermissionOption[] {
    assertApiKeyFeature(this.authOptions, "workspaceApiKey");
    RequestIdentity.assertCurrentWorkspace(workspace);
    const { permissions, allowed, defaults } = resolveApiKeyPermissionCatalog(
      this.authOptions,
      "member",
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

  /**
   * Returns a member-owned key in the selected workspace and within the caller's scope.
   * @param id - Identifier of the record to access.
   * @param workspace - The workspace that scopes this operation.
   * @returns Matching API key metadata with the credential hash omitted, or null.
   */
  async getWorkspaceApiKey(
    id: string,
    workspace: Workspace,
  ): Promise<ApiKeyMetadata<WorkspaceApiKey> | null> {
    assertApiKeyFeature(this.authOptions, "workspaceApiKey");
    this.assertWorkspacePrincipal(workspace);
    authorize("read", WorkspaceApiKey);
    const apiKey = await this.getVisibleApiKey(id, workspace);
    if (apiKey) {
      authorize("read", apiKey);
    }
    return apiKey ? toApiKeyView(apiKey) : null;
  }

  /**
   * Paginates all selected-workspace member keys within the caller's permission ceilings.
   * @param workspace - The workspace that scopes this operation.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @param member - Optional parent member whose keys are being listed.
   * @returns Paginated member API key metadata with credential hashes omitted.
   */
  async getWorkspaceApiKeyConnection(
    workspace: Workspace,
    args: ConnectionArgsInterface<ApiKey>,
    info?: GraphQLResolveInfo,
    member?: WorkspaceMember,
  ): Promise<ConnectionResult<ApiKeyMetadata<WorkspaceApiKey>>> {
    assertApiKeyFeature(this.authOptions, "workspaceApiKey");
    this.assertWorkspacePrincipal(workspace);
    authorize("read", WorkspaceApiKey);
    const where = this.getOwnedListFilter(workspace);
    if (member) {
      authorize("read", member);
      if (member.workspace.id !== workspace.id) {
        throw new ForbiddenException(
          "WorkspaceMember does not belong to the selected workspace",
        );
      }
      where.owner = member;
    }
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find(WorkspaceApiKeyConnection, args, {
      ...(info && { info }),
      where,
      populate: ["owner"],
      exclude: ["key"],
    });
    // Reject the whole page rather than silently changing cursor pagination.
    for (const { node } of connection.edges) {
      authorize("read", node);
    }
    return {
      ...connection,
      edges: connection.edges.map((edge) => {
        assertApiKeyOwner(edge.node, "workspace_member");
        return { ...edge, node: toApiKeyView(edge.node) };
      }),
    };
  }

  /**
   * Creates an API key owned by a workspace member.
   * @param workspace - The workspace that scopes this operation.
   * @param options - Configuration for this operation.
   * @returns Created key metadata and its one-time plaintext credential.
   */
  async createWorkspaceApiKey(
    workspace: Workspace,
    options: CreateWorkspaceApiKeyOptions,
  ): Promise<CreatedApiKey<WorkspaceApiKey>> {
    assertApiKeyFeature(this.authOptions, "workspaceApiKey");
    this.assertWorkspacePrincipal(workspace);
    authorize("write", WorkspaceApiKey);
    const permissions = normalizeApiKeyPermissions(
      this.authOptions,
      "member",
      options.permissions,
    );
    const member = await this.getCreationWorkspaceMember(
      workspace,
      options.member,
    );
    this.assertWorkspaceMemberPermissionCeiling(member, permissions);
    return await this.createKey(member, options, permissions);
  }

  /**
   * Updates a member-owned key in the selected workspace.
   * @param id - Identifier of the record to access.
   * @param input - Requested field values for the operation.
   * @returns Updated API key metadata without the stored credential hash.
   */
  async updateWorkspaceApiKey(
    id: string,
    input: UpdateApiKeyOptions,
  ): Promise<ApiKeyMetadata<WorkspaceApiKey>> {
    assertApiKeyFeature(this.authOptions, "workspaceApiKey");
    authorize("write", WorkspaceApiKey);
    const apiKey = await this.findWritableApiKey(id);
    authorize("write", apiKey);
    const permissions =
      input.permissions === undefined
        ? undefined
        : normalizeApiKeyPermissions(
            this.authOptions,
            "member",
            input.permissions ?? [],
          );
    // Naming a key must not rewrite or expand retired grants.
    // Expiration changes can restore access to an expired key, so validate them.
    if (permissions !== undefined || input.expiresAt !== undefined) {
      const finalPermissions =
        permissions ??
        normalizeApiKeyPermissions(
          this.authOptions,
          "member",
          apiKey.permissions ?? [],
        );
      this.assertWorkspaceMemberPermissionCeiling(
        Reference.unwrapReference(apiKey.owner),
        finalPermissions,
      );
    }
    return toApiKeyView(
      await ApiKeyLifecycle.update(
        this.em,
        this.authOptions,
        apiKey,
        input,
        permissions,
      ),
    );
  }

  /**
   * Permanently revokes a credential while retaining its audit metadata.
   * @param id - Identifier of the credential.
   * @returns Retained metadata with its revocation timestamp.
   */
  async revokeWorkspaceApiKey(
    id: string,
  ): Promise<ApiKeyMetadata<WorkspaceApiKey>> {
    assertApiKeyFeature(this.authOptions, "workspaceApiKey");
    authorize("write", WorkspaceApiKey);
    const key = await this.findWritableApiKey(id);
    authorize("write", key);
    return toApiKeyView(
      await ApiKeyLifecycle.revoke(this.em, this.authOptions, key),
    );
  }

  /**
   * Deletes a member-owned key in the selected workspace.
   * @param id - Identifier of the record to access.
   * @returns Deleted API key metadata without the stored credential hash.
   */
  async deleteWorkspaceApiKey(
    id: string,
  ): Promise<ApiKeyMetadata<WorkspaceApiKey>> {
    assertApiKeyFeature(this.authOptions, "workspaceApiKey");
    authorize("write", WorkspaceApiKey);
    const apiKey = await this.findWritableApiKey(id);
    authorize("write", apiKey);
    return toApiKeyView(
      await ApiKeyLifecycle.delete(this.em, this.authOptions, apiKey),
    );
  }

  private async getCreationWorkspaceMember(
    workspace: Workspace,
    owner?: WorkspaceMember | string,
  ): Promise<WorkspaceMember> {
    const member =
      typeof owner === "string"
        ? await this.em.findOne(
            WorkspaceMember,
            { id: owner, workspace },
            { populate: ["workspace", "user"], refresh: true },
          )
        : (owner ?? RequestContext.get(WorkspaceMember));
    if (!member) {
      throw new NotFoundException("Workspace member not found");
    }
    if (member.status !== "ACTIVE") {
      throw new ForbiddenException("An active workspace member is required");
    }
    if (member.workspace.id !== workspace.id) {
      throw new ForbiddenException(
        "The operation belongs to another workspace",
      );
    }
    if (
      member.type !== "SERVICE_ACCOUNT" &&
      (!RequestContext.get(User) ||
        !member.user ||
        member.user.id !== RequestContext.get(User)?.id)
    ) {
      throw new ForbiddenException(
        "You may only create API keys for yourself or a service account",
      );
    }
    return member;
  }

  private async createKey(
    member: WorkspaceMember,
    options: CreateWorkspaceApiKeyOptions,
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
        const entity = em.create(ApiKey, {
          ...data,
          owner: member,
          createdBy: RequestContext.get(User)?.id ?? null,
        });
        assertApiKeyOwner(entity, "workspace_member");
        authorize("write", entity);
        await em.persist(entity).flush();
        return entity;
      },
      { clear: true },
    );
    this.logger.log("API key created", {
      apiKeyId: entity.id,
      ownerId: member.id,
      ownerType: "workspace_member",
    });
    return { apiKey, entity: toApiKeyView(entity) };
  }

  private async getVisibleApiKey(
    id: string,
    workspace: Workspace,
  ): Promise<ApiKeyMetadata<WorkspaceApiKey> | null> {
    const apiKey = await this.em.findOne(
      ApiKey,
      {
        $and: [{ id }, this.getOwnedListFilter(workspace)],
      },
      { populate: ["owner"], exclude: ["key"] },
    );
    if (!apiKey) {
      return null;
    }
    assertApiKeyOwner(apiKey, "workspace_member");
    if (apiKey.member) {
      await this.em.populate(Reference.unwrapReference(apiKey.member), [
        "workspace",
      ]);
    }
    this.assertWorkspace(apiKey, workspace);
    assertApiKeyPermissionCeiling(this.authOptions, apiKey.permissions ?? []);
    return apiKey;
  }

  private async findWritableApiKey(
    id: string,
  ): Promise<ApiKeyMetadata<WorkspaceApiKey>> {
    const apiKey = await this.em.findOne(
      ApiKey,
      { id, ownerType: "workspace_member" },
      {
        populate: ["owner"],
        exclude: ["key"],
        refresh: true,
      },
    );
    if (apiKey?.ownerType !== "workspace_member") {
      throw new NotFoundException("API key not found");
    }
    assertApiKeyOwner(apiKey, "workspace_member");
    if (apiKey.member) {
      await this.em.populate(Reference.unwrapReference(apiKey.member), [
        "workspace",
      ]);
    }
    this.assertWorkspacePrincipal(this.unwrapWorkspace(apiKey));
    assertApiKeyPermissionCeiling(this.authOptions, apiKey.permissions ?? []);
    return apiKey;
  }

  private getOwnedListFilter(workspace: Workspace): FilterObject<ApiKey> {
    const ceiling = resolveRequestPermissions(this.authOptions).apiKey;
    return {
      ownerType: "workspace_member",
      [raw((alias) => `${alias}."owner_id"`)]: {
        $in: (this.em as SqlEntityManager)
          .createQueryBuilder(WorkspaceMember)
          .select("id")
          .where({ workspace: workspace.id })
          .toRaw(),
      },
      ...(ceiling !== null
        ? { permissions: { $contained: ceiling, $ne: [] } }
        : {}),
    };
  }

  private assertWorkspacePrincipal(workspace: Workspace): void {
    RequestIdentity.assertCurrentWorkspace(workspace);
    const apiKey = getCurrentApiKey();
    if (apiKey?.ownerType === "workspace_member") {
      this.assertWorkspace(apiKey, workspace);
    }
    const member = RequestContext.get(WorkspaceMember);
    if (member?.status !== "ACTIVE") {
      throw new ForbiddenException("An active workspace member is required");
    }
    RequestIdentity.assertCurrentWorkspaceMember(member);
    if (Reference.unwrapReference(member.workspace).id !== workspace.id) {
      throw new ForbiddenException(
        "Workspace member does not belong to this workspace",
      );
    }
  }

  private assertWorkspace(
    apiKey: ApiKeyMetadata,
    expectedWorkspace: Workspace,
  ): void {
    const workspace = this.unwrapWorkspace(apiKey);
    if (workspace.id !== expectedWorkspace.id) {
      throw new ForbiddenException(
        "You are not allowed to access this API key",
      );
    }
  }

  private unwrapWorkspace(apiKey: ApiKeyMetadata): Workspace {
    if (!apiKey.member) {
      throw new ForbiddenException("API key owner is missing");
    }
    return Reference.unwrapReference(
      Reference.unwrapReference(apiKey.member).workspace,
    );
  }

  private assertWorkspaceMemberPermissionCeiling(
    member: WorkspaceMember,
    permissions: readonly string[],
  ): void {
    const ownerPermissions = resolveWorkspaceMemberPermissions(
      this.authOptions,
      member,
    );
    if (!permissions.length) {
      assertApiKeyPermissionCeiling(this.authOptions, permissions);
    }
    assertPermissionCeiling(
      permissions,
      ownerPermissions,
      "WorkspaceMember API key permissions exceed owner permissions",
    );
    assertCanGrantPermissions(
      this.authOptions,
      "workspace",
      permissions.length ? permissions : ownerPermissions,
    );
  }
}
