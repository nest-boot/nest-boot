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
import { UserApiKeyConnection } from "../connections/user-api-key.connection-definition.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
import type { CreateApiKeyOptions } from "../interfaces/create-api-key-options.interface.js";
import type { CreatedApiKey } from "../interfaces/created-api-key.interface.js";
import type { UpdateApiKeyOptions } from "../interfaces/update-api-key-options.interface.js";
import type { UserApiKeyPermissionOption } from "../objects/user-api-key-permission-option.object.js";
import {
  generateApiKey,
  hashApiKey,
} from "../utils/api-key-credential.util.js";
import { resolveApiKeyPermissionCatalog } from "../utils/api-key-permissions.util.js";
import { normalizeAuthPermissions } from "../utils/auth-role.util.js";
import { resolveAuthCatalog } from "../utils/resolve-auth-catalog.util.js";
import { resolveUserPermissions } from "../utils/resolve-effective-permissions.util.js";
import { AccessControlService } from "./access-control.service.js";

/** Manages user-owned API keys within the current request's authorization scope. */
@Injectable()
export class UserApiKeyService {
  private readonly logger = new Logger(UserApiKeyService.name);

  /** Creates an API-key domain service. */
  constructor(
    /** MikroORM entity manager used for API-key persistence. */
    protected readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
    private readonly accessControlService: AccessControlService,
  ) {}

  /** Lists user-key grants subject to configuration and the current credential's ceiling. */
  getUserApiKeyPermissions(user: User): UserApiKeyPermissionOption[] {
    this.accessControlService.assertCurrentUser(user);
    const { permissions, allowed } = resolveApiKeyPermissionCatalog(
      this.authOptions,
      "user",
    );
    const allowedSet = new Set(allowed);
    const userPermissions = new Set(
      resolveAuthCatalog(this.authOptions, "user").permissions,
    );
    const ceiling = this.accessControlService.getApiKeyPermissionCeiling();
    return permissions.map((permission) => ({
      permission,
      default:
        this.authOptions.apiKey?.user?.defaultPermissions?.includes(
          permission,
        ) ?? false,
      grantable:
        allowedSet.has(permission) &&
        (!userPermissions.has(permission) ||
          this.accessControlService.canGrantUserPermissions([permission])) &&
        (ceiling === null || ceiling.includes(permission)),
    }));
  }

  /** Returns a user-owned API key when it belongs to the current user. */
  async getUserApiKey(id: string, user: User): Promise<UserApiKey | null> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("read", UserApiKey);
    const apiKey = await this.getVisibleApiKey(id, user);
    if (apiKey) {
      this.accessControlService.assertUserCan("read", apiKey);
    }
    return apiKey;
  }

  /** Paginates current-user keys after applying ownership and permission ceilings. */
  async getUserApiKeyConnection(
    user: User,
    args: ConnectionArgsInterface<UserApiKey>,
  ): Promise<ConnectionInterface<UserApiKey>> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("read", UserApiKey);
    const where = this.getOwnedListFilter(user);
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<UserApiKey>(UserApiKeyConnection, args, {
      where,
      exclude: ["key"] as never,
    });
    // Reject the whole page rather than silently changing cursor pagination.
    for (const { node } of connection.edges) {
      this.accessControlService.assertUserCan("read", node);
    }
    return connection;
  }

  /** Creates an API key owned by a user. */
  async createUserApiKey(
    user: User,
    options: CreateApiKeyOptions,
  ): Promise<CreatedApiKey<UserApiKey>> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("create", UserApiKey);
    const permissions = this.normalizeCreatePermissions(user, options);
    this.assertUserPermissionCeiling(user, permissions);
    return await this.createKey(user, options, permissions);
  }

  /** Updates an API key owned by the current user. */
  async updateUserApiKey(
    id: string,
    input: UpdateApiKeyOptions,
  ): Promise<UserApiKey> {
    this.accessControlService.assertUserCan("update", UserApiKey);
    const apiKey = await this.findWritableApiKey(id);
    this.accessControlService.assertUserCan("update", apiKey);
    const user = this.unwrapOwner(apiKey);
    const permissions = this.normalizeUpdatedPermissions(apiKey, input);
    // Allow disabling stale grants without replacing them.
    if (input.enabled !== false || permissions !== undefined) {
      const finalPermissions =
        permissions ??
        this.normalizePermissions(user, apiKey.permissions ?? []);
      this.assertUserPermissionCeiling(user, finalPermissions);
    }
    return await this.updateKey(apiKey, input, permissions);
  }

  /** Deletes an API key owned by the current user. */
  async deleteUserApiKey(id: string): Promise<UserApiKey> {
    this.accessControlService.assertUserCan("delete", UserApiKey);
    const apiKey = await this.findWritableApiKey(id);
    this.accessControlService.assertUserCan("delete", apiKey);
    return await this.deleteKey(apiKey);
  }

  private async createKey(
    owner: User,
    options: CreateApiKeyOptions,
    permissions: string[],
  ): Promise<CreatedApiKey<UserApiKey>> {
    if (options.expiresAt && options.expiresAt <= new Date()) {
      throw new BadRequestException("API key expiration must be in the future");
    }
    const prefix = options.prefix ?? process.env.API_KEY_PREFIX ?? "sk";
    const plaintextApiKey = generateApiKey(prefix);
    const entity = await this.em.transactional(
      async (em) => {
        const entity = em.create(UserApiKey, {
          enabled: true,
          expiresAt: options.expiresAt ?? null,
          key: hashApiKey(plaintextApiKey),
          name: options.name,
          user: owner,
          permissions,
          prefix,
          start: plaintextApiKey.slice(0, 8),
        } as RequiredEntityData<UserApiKey>);
        this.accessControlService.assertUserCan("create", entity);
        await em.persist(entity).flush();
        return entity;
      },
      { clear: true },
    );
    this.logger.log("API key created", {
      apiKeyId: entity.id,
      ownerId: owner.id,
      ownerType: "user",
    });
    return { apiKey: plaintextApiKey, entity };
  }

  private async updateKey(
    apiKey: UserApiKey,
    input: UpdateApiKeyOptions,
    permissions: string[] | undefined,
  ): Promise<UserApiKey> {
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

  private async deleteKey(apiKey: UserApiKey): Promise<UserApiKey> {
    RequestIdentity.assertApiKeyCanCommit(this.em, apiKey);
    await this.em.remove(apiKey).flush();
    RequestIdentity.updateApiKey(this.em, this.authOptions, apiKey, true);
    return apiKey;
  }

  private async getVisibleApiKey(
    id: string,
    owner: User,
  ): Promise<UserApiKey | null> {
    const apiKey = await this.em.findOne(
      UserApiKey,
      {
        $and: [{ id }, this.getOwnedListFilter(owner)],
      } as FilterQuery<UserApiKey>,
      { populate: ["user"] as never, exclude: ["key"] as never },
    );
    if (apiKey) {
      this.assertOwner(apiKey, owner);
      this.assertDelegatedApiKeyPermissionCeiling(apiKey.permissions ?? []);
    }
    return apiKey;
  }

  private async findWritableApiKey(id: string): Promise<UserApiKey> {
    const apiKey = await this.em.findOne(
      UserApiKey,
      { id } as FilterQuery<UserApiKey>,
      {
        populate: ["user"] as never,
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

  private getOwnedListFilter(owner: User): FilterQuery<UserApiKey> {
    const ceiling = this.accessControlService.getApiKeyPermissionCeiling();
    return {
      ["user"]: owner,
      ...(ceiling !== null ? { permissions: { $contained: ceiling } } : {}),
    } as unknown as FilterQuery<UserApiKey>;
  }

  private assertOwner(apiKey: UserApiKey, expectedOwner: User): void {
    const owner = this.unwrapOwner(apiKey);
    if (owner.id !== expectedOwner.id) {
      throw new ForbiddenException(
        "You are not allowed to access this API key",
      );
    }
  }
  private unwrapOwner(apiKey: UserApiKey): User {
    return Reference.unwrapReference(apiKey.user);
  }

  private normalizePermissions(
    owner: User,
    permissions: readonly string[],
  ): string[] {
    const userPermissions = resolveAuthCatalog(
      this.authOptions,
      "user",
    ).permissions;
    const workspacePermissions = resolveAuthCatalog(
      this.authOptions,
      "workspace",
    ).permissions;
    const availablePermissions = [...userPermissions, ...workspacePermissions];

    const normalizedPermissions = normalizeAuthPermissions(
      permissions,
      availablePermissions,
      "User API key",
    );
    this.assertPermissionCeiling(
      normalizedPermissions,
      resolveApiKeyPermissionCatalog(this.authOptions, "user").allowed,
      "API key permissions exceed configured allowedPermissions",
    );
    return normalizedPermissions;
  }

  private normalizeCreatePermissions(
    owner: User,
    options: CreateApiKeyOptions,
  ): string[] {
    return this.normalizePermissions(
      owner,
      options.permissions === undefined
        ? (this.authOptions.apiKey?.user?.defaultPermissions ?? [])
        : (options.permissions ?? []),
    );
  }

  private normalizeUpdatedPermissions(
    apiKey: UserApiKey,
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
      resolveAuthCatalog(this.authOptions, "user").permissions,
    );
    const requestedUserPermissions = permissions.filter((permission) =>
      userPermissionCatalog.has(permission),
    );
    const effectivePermissions = resolveUserPermissions(this.authOptions, user);

    this.assertPermissionCeiling(
      requestedUserPermissions,
      effectivePermissions,
      "User API key permissions exceed owner permissions",
    );
    this.assertDelegatedApiKeyPermissionCeiling(permissions);
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
