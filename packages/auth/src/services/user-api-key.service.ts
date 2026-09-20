import { EntityManager, type FilterQuery, Reference } from "@mikro-orm/core";
import type { SqlEntityManager } from "@mikro-orm/sql";
import {
  type ConnectionArgsInterface,
  type ConnectionInterface,
  ConnectionManager,
} from "@nest-boot/graphql-connection";
import {
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
import { ApiKeyLifecycle } from "../infrastructure/api-key-lifecycle.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
import type { CreateApiKeyOptions } from "../interfaces/create-api-key-options.interface.js";
import type { CreatedApiKey } from "../interfaces/created-api-key.interface.js";
import type { UpdateApiKeyOptions } from "../interfaces/update-api-key-options.interface.js";
import type { UserApiKeyPermissionOption } from "../objects/user-api-key-permission-option.object.js";
import {
  normalizeApiKeyPermissions,
  resolveApiKeyPermissionCatalog,
} from "../utils/api-key-permissions.util.js";
import { assertCan } from "../utils/assert-can.util.js";
import {
  assertApiKeyPermissionCeiling,
  assertPermissionCeiling,
  canGrantPermissions,
} from "../utils/permission-grants.util.js";
import { resolveAuthCatalog } from "../utils/resolve-auth-catalog.util.js";
import { resolveUserPermissions } from "../utils/resolve-effective-permissions.util.js";
import { resolveRequestPermissions } from "../utils/resolve-request-permissions.util.js";

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
  ) {}

  /** Lists user-key grants subject to configuration and the current credential's ceiling. */
  getUserApiKeyPermissions(user: User): UserApiKeyPermissionOption[] {
    RequestIdentity.assertCurrentUser(user);
    const { permissions, allowed, defaults } = resolveApiKeyPermissionCatalog(
      this.authOptions,
      "user",
    );
    const allowedSet = new Set(allowed);
    const userPermissions = new Set(
      resolveAuthCatalog(this.authOptions, "user").permissions,
    );
    const ceiling = resolveRequestPermissions(this.authOptions).apiKey;
    return permissions.map((permission) => ({
      permission,
      default: defaults.includes(permission),
      grantable:
        allowedSet.has(permission) &&
        (!userPermissions.has(permission) ||
          canGrantPermissions(this.authOptions, "user", [permission])) &&
        (ceiling === null || ceiling.includes(permission)),
    }));
  }

  /** Returns a user-owned API key when it belongs to the current user. */
  async getUserApiKey(id: string, user: User): Promise<UserApiKey | null> {
    RequestIdentity.assertCurrentUser(user);
    assertCan("read", UserApiKey);
    const apiKey = await this.getVisibleApiKey(id, user);
    if (apiKey) {
      assertCan("read", apiKey);
    }
    return apiKey;
  }

  /** Paginates current-user keys after applying ownership and permission ceilings. */
  async getUserApiKeyConnection(
    user: User,
    args: ConnectionArgsInterface<UserApiKey>,
  ): Promise<ConnectionInterface<UserApiKey>> {
    RequestIdentity.assertCurrentUser(user);
    assertCan("read", UserApiKey);
    const where = this.getOwnedListFilter(user);
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<UserApiKey>(UserApiKeyConnection, args, {
      where,
      exclude: ["key"] as never,
    });
    // Reject the whole page rather than silently changing cursor pagination.
    for (const { node } of connection.edges) {
      assertCan("read", node);
    }
    return connection;
  }

  /** Creates an API key owned by a user. */
  async createUserApiKey(
    user: User,
    options: CreateApiKeyOptions,
  ): Promise<CreatedApiKey<UserApiKey>> {
    RequestIdentity.assertCurrentUser(user);
    assertCan("write", UserApiKey);
    const permissions = normalizeApiKeyPermissions(
      this.authOptions,
      "user",
      options.permissions,
    );
    this.assertUserPermissionCeiling(user, permissions);
    return await this.createKey(user, options, permissions);
  }

  /** Updates an API key owned by the current user. */
  async updateUserApiKey(
    id: string,
    input: UpdateApiKeyOptions,
  ): Promise<UserApiKey> {
    assertCan("write", UserApiKey);
    const apiKey = await this.findWritableApiKey(id);
    assertCan("write", apiKey);
    const user = this.unwrapUser(apiKey);
    const permissions =
      input.permissions === undefined
        ? undefined
        : normalizeApiKeyPermissions(
            this.authOptions,
            "user",
            input.permissions ?? [],
          );
    // Allow disabling stale grants without replacing them.
    if (input.enabled !== false || permissions !== undefined) {
      const finalPermissions =
        permissions ??
        normalizeApiKeyPermissions(
          this.authOptions,
          "user",
          apiKey.permissions ?? [],
        );
      this.assertUserPermissionCeiling(user, finalPermissions);
    }
    return await ApiKeyLifecycle.update(
      this.em,
      this.authOptions,
      apiKey,
      input,
      permissions,
    );
  }

  /** Deletes an API key owned by the current user. */
  async deleteUserApiKey(id: string): Promise<UserApiKey> {
    assertCan("write", UserApiKey);
    const apiKey = await this.findWritableApiKey(id);
    assertCan("write", apiKey);
    return await ApiKeyLifecycle.delete(this.em, this.authOptions, apiKey);
  }

  private async createKey(
    user: User,
    options: CreateApiKeyOptions,
    permissions: string[],
  ): Promise<CreatedApiKey<UserApiKey>> {
    const { apiKey, data } = ApiKeyLifecycle.prepareCreation(
      options,
      permissions,
    );
    const entity = await this.em.transactional(
      async (em) => {
        const entity = em.create(UserApiKey, {
          ...data,
          user,
        });
        assertCan("write", entity);
        await em.persist(entity).flush();
        return entity;
      },
      { clear: true },
    );
    this.logger.log("API key created", {
      apiKeyId: entity.id,
      ownerId: user.id,
      ownerType: "user",
    });
    return { apiKey, entity };
  }

  private async getVisibleApiKey(
    id: string,
    user: User,
  ): Promise<UserApiKey | null> {
    const apiKey = await this.em.findOne(
      UserApiKey,
      {
        $and: [{ id }, this.getOwnedListFilter(user)],
      },
      { populate: ["user"], exclude: ["key"] as never },
    );
    if (apiKey) {
      this.assertUser(apiKey, user);
      assertApiKeyPermissionCeiling(this.authOptions, apiKey.permissions ?? []);
    }
    return apiKey;
  }

  private async findWritableApiKey(id: string): Promise<UserApiKey> {
    const apiKey = await this.em.findOne(
      UserApiKey,
      { id },
      {
        populate: ["user"],
        exclude: ["key"] as never,
        refresh: true,
      },
    );
    if (!apiKey) {
      throw new NotFoundException("API key not found");
    }
    RequestIdentity.assertCurrentUser(this.unwrapUser(apiKey));
    assertApiKeyPermissionCeiling(this.authOptions, apiKey.permissions ?? []);
    return apiKey;
  }

  private getOwnedListFilter(user: User): FilterQuery<UserApiKey> {
    const ceiling = resolveRequestPermissions(this.authOptions).apiKey;
    return {
      user,
      ...(ceiling !== null ? { permissions: { $contained: ceiling } } : {}),
    };
  }

  private assertUser(apiKey: UserApiKey, expectedUser: User): void {
    const user = this.unwrapUser(apiKey);
    if (user.id !== expectedUser.id) {
      throw new ForbiddenException(
        "You are not allowed to access this API key",
      );
    }
  }

  private unwrapUser(apiKey: UserApiKey): User {
    if (!apiKey.user) throw new ForbiddenException("API key owner is missing");
    return Reference.unwrapReference(apiKey.user);
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

    assertPermissionCeiling(
      requestedUserPermissions,
      effectivePermissions,
      "User API key permissions exceed owner permissions",
    );
    assertApiKeyPermissionCeiling(this.authOptions, permissions);
  }
}
