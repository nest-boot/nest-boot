import { createHash, randomBytes } from "node:crypto";

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
  UnauthorizedException,
} from "@nestjs/common";

import { MODULE_OPTIONS_TOKEN } from "../auth.module-definition.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { ApiKeyConnection } from "../connections/api-key.connection-definition.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import type { CreateApiKeyOptions } from "../interfaces/create-api-key-options.interface.js";
import type { CreatedApiKey } from "../interfaces/created-api-key.interface.js";
import type { UpdateApiKeyOptions } from "../interfaces/update-api-key-options.interface.js";
import type { ApiKeyValidation } from "../types/api-key-validation.type.js";
import {
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLE,
  DEFAULT_USER_ROLES,
} from "../user.constants.js";
import {
  normalizeAuthPermissions,
  resolveAuthPermissions,
} from "../utils/auth-role.util.js";
import { DEFAULT_WORKSPACE_PERMISSIONS } from "../workspace.constants.js";
import { AccessControlService } from "./access-control.service.js";

/** Domain service for user and workspace API-key lifecycle and authentication. */
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  /** Creates an API-key domain service. */
  constructor(
    /** MikroORM entity manager used for API-key persistence. */
    protected readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
    private readonly accessControlService: AccessControlService,
  ) {}

  /** Returns a user-owned API key when it belongs to the current user. */
  async getUserApiKey(id: string, user: User): Promise<ApiKey | null> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("read", ApiKey);
    return await this.getVisibleApiKey(id, user);
  }

  /** Returns a key owned by the authenticated workspace and within the caller's scope. */
  async getWorkspaceApiKey(
    id: string,
    workspace: Workspace,
  ): Promise<ApiKey | null> {
    this.assertWorkspacePrincipal(workspace);
    this.accessControlService.assertWorkspaceCan("read", ApiKey);
    return await this.getVisibleApiKey(id, workspace);
  }

  /** Paginates current-user keys after applying ownership and permission ceilings. */
  async getApiKeyConnectionByUser(
    user: User,
    args: ConnectionArgsInterface<ApiKey>,
  ): Promise<ConnectionInterface<ApiKey>> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("read", ApiKey);
    const where = this.getOwnedListFilter(user);
    return await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<ApiKey>(ApiKeyConnection, args, {
      where,
      exclude: ["key"] as never,
    });
  }

  /** Paginates selected-workspace keys after applying ownership and permission ceilings. */
  async getApiKeyConnectionByWorkspace(
    workspace: Workspace,
    args: ConnectionArgsInterface<ApiKey>,
  ): Promise<ConnectionInterface<ApiKey>> {
    this.assertWorkspacePrincipal(workspace);
    this.accessControlService.assertWorkspaceCan("read", ApiKey);
    const where = this.getOwnedListFilter(workspace);
    return await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<ApiKey>(ApiKeyConnection, args, {
      where,
      exclude: ["key"] as never,
    });
  }

  /** Creates an API key owned by a user. */
  async createUserApiKey(
    user: User,
    options: CreateApiKeyOptions,
  ): Promise<CreatedApiKey> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("create", ApiKey);
    const permissions = this.normalizeCreatePermissions(user, options);
    this.assertUserPermissionCeiling(user, permissions);
    return await this.createKey(user, options, permissions);
  }

  /** Creates an API key owned by a workspace. */
  async createWorkspaceApiKey(
    workspace: Workspace,
    options: CreateApiKeyOptions,
  ): Promise<CreatedApiKey> {
    this.assertWorkspacePrincipal(workspace);
    this.accessControlService.assertWorkspaceCan("create", ApiKey);
    const permissions = this.normalizeCreatePermissions(workspace, options);
    this.accessControlService.assertCanGrantWorkspacePermissions(permissions);
    return await this.createKey(workspace, options, permissions);
  }

  /** Updates an API key owned by the current user. */
  async updateUserApiKey(
    id: string,
    input: UpdateApiKeyOptions,
  ): Promise<ApiKey> {
    this.accessControlService.assertUserCan("update", ApiKey);
    const apiKey = await this.findWritableApiKey(id, "user");
    this.accessControlService.assertUserCan("update", apiKey);
    const user = this.unwrapOwner(apiKey) as User;
    const permissions = this.normalizeUpdatedPermissions(apiKey, input);
    const finalPermissions =
      permissions ?? this.normalizePermissions(user, apiKey.permissions ?? []);
    this.assertUserPermissionCeiling(user, finalPermissions);
    return await this.updateKey(apiKey, input, permissions);
  }

  /** Updates a key owned by the authenticated workspace. */
  async updateWorkspaceApiKey(
    id: string,
    input: UpdateApiKeyOptions,
  ): Promise<ApiKey> {
    this.accessControlService.assertWorkspaceCan("update", ApiKey);
    const apiKey = await this.findWritableApiKey(id, "workspace");
    this.accessControlService.assertWorkspaceCan("update", apiKey);
    const permissions = this.normalizeUpdatedPermissions(apiKey, input);
    const finalPermissions =
      permissions ??
      this.normalizePermissions(
        this.unwrapOwner(apiKey),
        apiKey.permissions ?? [],
      );
    this.accessControlService.assertCanGrantWorkspacePermissions(
      finalPermissions,
    );
    return await this.updateKey(apiKey, input, permissions);
  }

  /** Deletes an API key owned by the current user. */
  async deleteUserApiKey(id: string): Promise<ApiKey> {
    this.accessControlService.assertUserCan("delete", ApiKey);
    const apiKey = await this.findWritableApiKey(id, "user");
    this.accessControlService.assertUserCan("delete", apiKey);
    return await this.deleteKey(apiKey);
  }

  /** Deletes a key owned by the authenticated workspace. */
  async deleteWorkspaceApiKey(id: string): Promise<ApiKey> {
    this.accessControlService.assertWorkspaceCan("delete", ApiKey);
    const apiKey = await this.findWritableApiKey(id, "workspace");
    this.accessControlService.assertWorkspaceCan("delete", apiKey);
    return await this.deleteKey(apiKey);
  }

  /** Validates a plaintext API key and resolves its owner. */
  async validate(apiKey: string): Promise<ApiKeyValidation> {
    if (!apiKey) {
      throw new UnauthorizedException("Missing API key");
    }

    const row = await this.findValidationRow(apiKey);
    if (!row) {
      throw new UnauthorizedException("Invalid API key");
    }
    if (!row.apiKey.enabled) {
      throw new UnauthorizedException("API key is disabled");
    }
    if (row.apiKey.expiresAt && new Date(row.apiKey.expiresAt) <= new Date()) {
      throw new UnauthorizedException("API key has expired");
    }
    return row;
  }

  /** Records the last successful use of an API key. */
  async recordUsage(apiKey: ApiKey): Promise<ApiKey> {
    const now = new Date();
    apiKey.lastUsedAt = now;
    apiKey.updatedAt = now;
    await this.em.nativeUpdate(
      ApiKey,
      { id: apiKey.id } as FilterQuery<ApiKey>,
      { lastUsedAt: now, updatedAt: now } as never,
    );
    return apiKey;
  }

  private async findOne(where: FilterQuery<ApiKey>): Promise<ApiKey | null> {
    return await this.em.findOne(ApiKey, where, {
      populate: ["user", "workspace"] as never,
    });
  }

  private async createKey(
    owner: User | Workspace,
    options: CreateApiKeyOptions,
    permissions: string[],
  ): Promise<CreatedApiKey> {
    if (options.expiresAt && options.expiresAt <= new Date()) {
      throw new BadRequestException("API key expiration must be in the future");
    }
    const prefix = options.prefix ?? process.env.API_KEY_PREFIX ?? "sk";
    this.assertValidPrefix(prefix);
    const plaintextApiKey = `${prefix}${randomBytes(48).toString("base64url")}`;
    const entity = await this.em.transactional(
      async (em) => {
        const entity = em.create(ApiKey, {
          enabled: true,
          expiresAt: options.expiresAt ?? null,
          key: this.hashApiKey(plaintextApiKey),
          name: options.name,
          user: this.getOwnerType(owner) === "user" ? owner : null,
          workspace: this.getOwnerType(owner) === "workspace" ? owner : null,
          permissions,
          prefix,
          start: plaintextApiKey.slice(0, 8),
        } as RequiredEntityData<ApiKey>);

        await em.persist(entity).flush();
        return entity;
      },
      { clear: true },
    );
    this.logger.log("API key created", {
      apiKeyId: entity.id,
      ownerId: owner.id,
      ownerType: this.getOwnerType(owner),
    });
    return { apiKey: plaintextApiKey, entity };
  }

  private async updateKey(
    apiKey: ApiKey,
    input: UpdateApiKeyOptions,
    permissions: string[] | undefined,
  ): Promise<ApiKey> {
    if (input.expiresAt && input.expiresAt <= new Date()) {
      throw new BadRequestException("API key expiration must be in the future");
    }
    if (input.name !== undefined) apiKey.name = input.name;
    if (input.enabled !== undefined) apiKey.enabled = input.enabled;
    if (input.expiresAt !== undefined) apiKey.expiresAt = input.expiresAt;
    if (permissions !== undefined) {
      apiKey.permissions = permissions;
    }
    await this.em.persist(apiKey).flush();
    return apiKey;
  }

  private async deleteKey(apiKey: ApiKey): Promise<ApiKey> {
    await this.em.remove(apiKey).flush();
    return apiKey;
  }

  private async getVisibleApiKey(
    id: string,
    owner: User | Workspace,
  ): Promise<ApiKey | null> {
    const apiKey = await this.em.findOne(
      ApiKey,
      {
        $and: [{ id }, this.getOwnedListFilter(owner)],
      } as FilterQuery<ApiKey>,
      { populate: ["user", "workspace"] as never, exclude: ["key"] as never },
    );
    if (apiKey) {
      this.assertOwner(apiKey, owner);
      this.assertDelegatedApiKeyPermissionCeiling(apiKey.permissions ?? []);
    }
    return apiKey;
  }

  private async findWritableApiKey(
    id: string,
    ownerType: "user" | "workspace",
  ): Promise<ApiKey> {
    const apiKey = await this.em.findOne(
      ApiKey,
      { id } as FilterQuery<ApiKey>,
      {
        populate: ["user", "workspace"] as never,
        exclude: ["key"] as never,
        refresh: true,
      },
    );
    if (!apiKey || this.getOwnerType(this.unwrapOwner(apiKey)) !== ownerType) {
      throw new NotFoundException("API key not found");
    }
    this.accessControlService.assertApiKeyOwner(apiKey);
    this.accessControlService.assertApiKeyPermissionCeiling(
      apiKey.permissions ?? [],
    );
    return apiKey;
  }

  private getOwnedListFilter(owner: User | Workspace): FilterQuery<ApiKey> {
    const apiKey = this.getAuthenticatingApiKey();
    return {
      [this.getOwnerType(owner)]: owner,
      ...(apiKey
        ? { permissions: { $contained: apiKey.permissions ?? [] } }
        : {}),
    } as unknown as FilterQuery<ApiKey>;
  }

  private assertWorkspacePrincipal(workspace: Workspace): void {
    this.accessControlService.assertCurrentWorkspace(workspace);
    const apiKey = this.getAuthenticatingApiKey();
    if (apiKey && this.getOwnerType(this.unwrapOwner(apiKey)) === "workspace") {
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

  private assertOwner(apiKey: ApiKey, expectedOwner: User | Workspace): void {
    const owner = this.unwrapOwner(apiKey);
    if (
      this.getOwnerType(owner) !== this.getOwnerType(expectedOwner) ||
      owner.id !== expectedOwner.id
    ) {
      throw new ForbiddenException(
        "You are not allowed to access this API key",
      );
    }
  }

  private async findValidationRow(
    plaintextApiKey: string,
  ): Promise<ApiKeyValidation | null> {
    const entity = await this.findOne({
      key: this.hashApiKey(plaintextApiKey),
    } as FilterQuery<ApiKey>);
    if (!entity) return null;

    const owner = this.unwrapOwner(entity);
    const ownerType = this.getOwnerType(owner);
    if (ownerType === "user") {
      const user = owner as User;
      if (
        user.banned &&
        (!user.banExpiresAt || user.banExpiresAt.getTime() > Date.now())
      ) {
        return null;
      }
      return { apiKey: entity, ownerType, user };
    }
    if ((owner as Workspace).deletedAt) return null;
    return { apiKey: entity, ownerType, workspace: owner as Workspace };
  }

  private getOwnerType(owner: User | Workspace): "user" | "workspace" {
    if (owner instanceof User) return "user";
    if (owner instanceof Workspace) return "workspace";
    throw new TypeError("Unsupported API key owner type");
  }

  private unwrapOwner(apiKey: ApiKey): User | Workspace {
    if (!!apiKey.user === !!apiKey.workspace) {
      throw new TypeError("Exactly one API key owner is required");
    }
    return Reference.unwrapReference(
      (apiKey.user ?? apiKey.workspace) as never,
    ) as unknown as User | Workspace;
  }

  private hashApiKey(apiKey: string): string {
    return createHash("sha256").update(apiKey).digest("base64url");
  }

  private assertValidPrefix(prefix: string): void {
    if (
      prefix.length < 1 ||
      prefix.length > 32 ||
      !/^[a-z]/u.test(prefix) ||
      /[^a-z0-9]/u.test(prefix)
    ) {
      throw new BadRequestException(
        "API key prefix must contain 1–32 lowercase letters or digits and start with a lowercase letter",
      );
    }
  }

  private normalizePermissions(
    owner: User | Workspace,
    permissions: readonly string[],
  ): string[] {
    const ownerType = this.getOwnerType(owner);
    const userPermissions =
      this.authOptions.user?.permissions ?? DEFAULT_USER_PERMISSIONS;
    const workspacePermissions =
      this.authOptions.workspace?.permissions ?? DEFAULT_WORKSPACE_PERMISSIONS;
    const availablePermissions =
      ownerType === "user"
        ? [...userPermissions, ...workspacePermissions]
        : workspacePermissions;

    const normalizedPermissions = normalizeAuthPermissions(
      permissions,
      availablePermissions,
      ownerType === "user" ? "User API key" : "Workspace API key",
    );
    this.assertPermissionCeiling(
      normalizedPermissions,
      this.authOptions.apiKey?.allowedPermissions ?? [
        ...userPermissions,
        ...workspacePermissions,
      ],
      "API key permissions exceed configured allowedPermissions",
    );
    return normalizedPermissions;
  }

  private normalizeCreatePermissions(
    owner: User | Workspace,
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
    apiKey: ApiKey,
    input: UpdateApiKeyOptions,
  ): string[] | undefined {
    return input.permissions === undefined
      ? undefined
      : this.normalizePermissions(
          this.unwrapOwner(apiKey),
          input.permissions ?? [],
        );
  }

  private assertUserPermissionCeiling(
    user: User,
    permissions: readonly string[],
  ): void {
    const userPermissionCatalog = new Set(
      this.authOptions.user?.permissions ?? DEFAULT_USER_PERMISSIONS,
    );
    const requestedUserPermissions = permissions.filter((permission) =>
      userPermissionCatalog.has(permission),
    );
    const effectivePermissions = resolveAuthPermissions(
      user.roles ?? [this.authOptions.user?.defaultRole ?? DEFAULT_USER_ROLE],
      user.permissions ?? [],
      this.authOptions.user?.roles ?? DEFAULT_USER_ROLES,
    );

    this.assertPermissionCeiling(
      requestedUserPermissions,
      effectivePermissions,
      "User API key permissions exceed owner permissions",
    );
    this.assertDelegatedApiKeyPermissionCeiling(permissions);
  }

  private getAuthenticatingApiKey(): ApiKey | null {
    return RequestContext.isActive()
      ? (RequestContext.get(ApiKey) ?? null)
      : null;
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
