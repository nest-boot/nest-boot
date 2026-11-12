import { EntityManager, type FilterQuery, Reference } from "@mikro-orm/core";
import type { SqlEntityManager } from "@mikro-orm/sql";
import {
  type ConnectionArgsInterface,
  ConnectionManager,
  type ConnectionResult,
} from "@nest-boot/graphql-connection";
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
  assertPermissionCeiling,
  canGrantPermissions,
} from "../../common/utils/permission-grants.util.js";
import { resolveAuthCatalog } from "../../common/utils/resolve-auth-catalog.util.js";
import { resolveUserPermissions } from "../../common/utils/resolve-effective-permissions.util.js";
import { resolveRequestPermissions } from "../../common/utils/resolve-request-permissions.util.js";
import { MODULE_OPTIONS_TOKEN } from "../../core/auth.module-definition.js";
import { User } from "../../core/entities/user.entity.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import { assertCurrentUser } from "../../core/utils/assert-current-identity.util.js";
import { UserApiKeyConnection } from "../connections/user-api-key.connection-definition.js";
import { ApiKey, type OwnedApiKey } from "../entities/api-key.entity.js";
import type { CreateApiKeyOptions } from "../interfaces/create-api-key-options.interface.js";
import type { CreatedApiKey } from "../interfaces/created-api-key.interface.js";
import type { UpdateApiKeyOptions } from "../interfaces/update-api-key-options.interface.js";
import { UserApiKey } from "../objects/user-api-key.object.js";
import type { UserApiKeyPermissionOption } from "../objects/user-api-key-permission-option.object.js";
import {
  normalizeApiKeyPermissions,
  resolveApiKeyPermissionCatalog,
} from "../utils/api-key-permissions.util.js";
import { toApiKeyView } from "../utils/api-key-view.util.js";
import { assertApiKeyFeature } from "../utils/assert-api-key-feature.util.js";
import { assertApiKeyOwner } from "../utils/assert-api-key-owner.util.js";
import { ApiKeyService } from "./api-key.service.js";

/** Manages user-owned API keys within the current request's authorization scope. */
@Injectable()
export class UserApiKeyService {
  private readonly logger = new Logger(UserApiKeyService.name);

  /**
   * Creates an API-key domain service.
   * @param em - Entity manager used for persistence.
   * @param authOptions - Authentication module configuration.
   * @param apiKeys - Shared credential persistence service.
   */
  constructor(
    /** MikroORM entity manager used for API-key persistence. */
    protected readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
    private readonly apiKeys: ApiKeyService,
  ) {}

  /**
   * Lists user-key grants subject to configuration and the current credential's ceiling.
   * @param user - The user whose account is being accessed.
   * @returns User API key permission choices with defaults and grant availability.
   */
  getUserApiKeyPermissions(user: User): UserApiKeyPermissionOption[] {
    assertApiKeyFeature(this.authOptions, "userApiKey");
    assertCurrentUser(user);
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

  /**
   * Returns a user-owned API key when it belongs to the current user.
   * @param id - Identifier of the record to access.
   * @param user - The user whose account is being accessed.
   * @returns Matching API key metadata with the credential hash omitted, or null.
   */
  async getUserApiKey(id: string, user: User): Promise<UserApiKey | null> {
    assertApiKeyFeature(this.authOptions, "userApiKey");
    assertCurrentUser(user);
    authorize("read", UserApiKey);
    const apiKey = await this.getVisibleApiKey(id, user);
    if (apiKey) {
      authorize("read", apiKey);
    }
    return apiKey ? toApiKeyView(apiKey) : null;
  }

  /**
   * Paginates current-user keys after applying ownership and permission ceilings.
   * @param user - The user whose account is being accessed.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated user API key metadata with credential hashes omitted.
   */
  async getUserApiKeyConnection(
    user: User,
    args: ConnectionArgsInterface<ApiKey>,
    info?: GraphQLResolveInfo,
  ): Promise<ConnectionResult<UserApiKey>> {
    assertApiKeyFeature(this.authOptions, "userApiKey");
    assertCurrentUser(user);
    authorize("read", UserApiKey);
    const where = this.getOwnedListFilter(user);
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find(UserApiKeyConnection, args, {
      ...(info && { info }),
      where,
      exclude: ["key"],
    });
    // Reject the whole page rather than silently changing cursor pagination.
    for (const { node } of connection.edges) {
      authorize("read", node);
    }
    return {
      ...connection,
      edges: connection.edges.map((edge) => {
        assertApiKeyOwner(edge.node, "user");
        return { ...edge, node: toApiKeyView(edge.node) };
      }),
    };
  }

  /**
   * Creates an API key owned by a user.
   * @param user - The user whose account is being accessed.
   * @param options - Configuration for this operation.
   * @returns Created key metadata and its one-time plaintext credential.
   */
  async createUserApiKey(
    user: User,
    options: CreateApiKeyOptions,
  ): Promise<CreatedApiKey<UserApiKey>> {
    assertApiKeyFeature(this.authOptions, "userApiKey");
    assertCurrentUser(user);
    authorize("write", UserApiKey);
    const permissions = normalizeApiKeyPermissions(
      this.authOptions,
      "user",
      options.permissions,
    );
    this.assertUserPermissionCeiling(user, permissions);
    return await this.createKey(user, options, permissions);
  }

  /**
   * Updates an API key owned by the current user.
   * @param id - Identifier of the record to access.
   * @param input - Requested field values for the operation.
   * @returns Updated API key metadata without the stored credential hash.
   */
  async updateUserApiKey(
    id: string,
    input: UpdateApiKeyOptions,
  ): Promise<UserApiKey> {
    assertApiKeyFeature(this.authOptions, "userApiKey");
    authorize("write", UserApiKey);
    const apiKey = await this.findWritableApiKey(id);
    authorize("write", apiKey);
    const user = this.unwrapUser(apiKey);
    const permissions =
      input.permissions === undefined
        ? undefined
        : normalizeApiKeyPermissions(
            this.authOptions,
            "user",
            input.permissions ?? [],
          );
    // Naming a key must not rewrite or expand retired grants.
    // Expiration changes can restore access to an expired key, so validate them.
    if (permissions !== undefined || input.expiresAt !== undefined) {
      const finalPermissions =
        permissions ??
        normalizeApiKeyPermissions(
          this.authOptions,
          "user",
          apiKey.permissions ?? [],
        );
      this.assertUserPermissionCeiling(user, finalPermissions);
    }
    return toApiKeyView(await this.apiKeys.update(apiKey, input, permissions));
  }

  /**
   * Permanently revokes a credential while retaining its audit metadata.
   * @param id - Identifier of the credential.
   * @returns Retained metadata with its revocation timestamp.
   */
  async revokeUserApiKey(id: string): Promise<UserApiKey> {
    assertApiKeyFeature(this.authOptions, "userApiKey");
    authorize("write", UserApiKey);
    const key = await this.findWritableApiKey(id);
    authorize("write", key);
    return toApiKeyView(await this.apiKeys.revoke(key));
  }

  /**
   * Deletes an API key owned by the current user.
   * @param id - Identifier of the record to access.
   * @returns Deleted API key metadata without the stored credential hash.
   */
  async deleteUserApiKey(id: string): Promise<UserApiKey> {
    assertApiKeyFeature(this.authOptions, "userApiKey");
    authorize("write", UserApiKey);
    const apiKey = await this.findWritableApiKey(id);
    authorize("write", apiKey);
    return toApiKeyView(await this.apiKeys.delete(apiKey));
  }

  private async createKey(
    user: User,
    options: CreateApiKeyOptions,
    permissions: string[],
  ): Promise<CreatedApiKey<UserApiKey>> {
    const { apiKey, data } = this.apiKeys.prepareCreation(
      options,
      permissions,
      this.authOptions.apiKey?.user?.defaultPrefix ??
        process.env.API_KEY_PREFIX ??
        "user_",
    );
    const entity = await this.em.transactional(
      async (em) => {
        const entity = em.create(ApiKey, {
          ...data,
          owner: user,
          createdBy: user.id,
        });
        assertApiKeyOwner(entity, "user");
        authorize("write", entity);
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
    return { apiKey, entity: toApiKeyView(entity) };
  }

  private async getVisibleApiKey(
    id: string,
    user: User,
  ): Promise<OwnedApiKey<"user"> | null> {
    const apiKey = await this.em.findOne(
      ApiKey,
      {
        $and: [{ id }, this.getOwnedListFilter(user)],
      },
      { populate: ["owner"], exclude: ["key"] },
    );
    if (!apiKey) {
      return null;
    }
    assertApiKeyOwner(apiKey, "user");
    this.assertUser(apiKey, user);
    assertApiKeyPermissionCeiling(this.authOptions, apiKey.permissions ?? []);
    return apiKey;
  }

  private async findWritableApiKey(id: string): Promise<OwnedApiKey<"user">> {
    const apiKey = await this.em.findOne(
      ApiKey,
      { id, ownerType: "user" },
      {
        populate: ["owner"],
        exclude: ["key"],
        refresh: true,
      },
    );
    if (apiKey?.ownerType !== "user") {
      throw new NotFoundException("API key not found");
    }
    assertApiKeyOwner(apiKey, "user");
    assertCurrentUser(this.unwrapUser(apiKey));
    assertApiKeyPermissionCeiling(this.authOptions, apiKey.permissions ?? []);
    return apiKey;
  }

  private getOwnedListFilter(user: User): FilterQuery<ApiKey> {
    const ceiling = resolveRequestPermissions(this.authOptions).apiKey;
    return {
      ownerType: "user",
      owner: user,
      ...(ceiling !== null
        ? { permissions: { $contained: ceiling, $ne: [] } }
        : {}),
    };
  }

  private assertUser(apiKey: Pick<ApiKey, "user">, expectedUser: User): void {
    const user = this.unwrapUser(apiKey);
    if (user.id !== expectedUser.id) {
      throw new ForbiddenException(
        "You are not allowed to access this API key",
      );
    }
  }

  private unwrapUser(apiKey: Pick<ApiKey, "user">): User {
    if (!apiKey.user) {
      throw new ForbiddenException("API key owner is missing");
    }
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
