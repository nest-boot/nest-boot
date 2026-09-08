import { createHash, randomBytes } from "node:crypto";

import {
  type EntityClass,
  EntityManager,
  type FilterQuery,
  Reference,
  type RequiredEntityData,
} from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "@nest-boot/row-level-security";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import { AccessControlService } from "./access-control.service.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import {
  BaseApiKey,
  type BaseUser,
  type BaseWorkspace,
  BaseWorkspaceMember,
} from "./entities/index.js";
import {
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLE,
  DEFAULT_USER_ROLES,
} from "./user.constants.js";
import {
  normalizeAuthPermissions,
  resolveAuthPermissions,
} from "./utils/auth-role.util.js";
import { DEFAULT_WORKSPACE_PERMISSIONS } from "./workspace.constants.js";

/** Input accepted when creating an API key. */
export interface CreateApiKeyOptions {
  /** API-key display name. */
  name: string;
  /** Optional expiration timestamp. */
  expiresAt?: Date | null;
  /**
   * Operations granted to the key. Omission uses the configured defaults;
   * `null` or an empty list creates a key without permissions.
   */
  permissions?: string[] | null;
  /** 1–32 lowercase letters or digits, starting with a letter. Defaults to `sk`. */
  prefix?: string;
}

/** Input accepted when updating an API key. */
export interface UpdateApiKeyOptions {
  /** Whether the key can authenticate requests. */
  enabled?: boolean;
  /** Optional expiration timestamp; `null` removes expiration. */
  expiresAt?: Date | null;
  /** API-key display name. */
  name?: string;
  /**
   * Replacement permission list. Omission preserves the stored permissions;
   * `null` clears them.
   */
  permissions?: string[] | null;
}

/** API-key creation result. The plaintext key is returned only once. */
export interface CreatedApiKey<ApiKey extends BaseApiKey> {
  /** Persisted API-key entity. */
  entity: ApiKey;
  /** Plaintext API key. */
  apiKey: string;
}

/** Successful authentication for a user-owned API key. */
export interface UserApiKeyValidation<
  ApiKey extends BaseApiKey,
  User extends BaseUser,
> {
  /** Validated API-key entity. */
  apiKey: ApiKey;
  /** Identifies the polymorphic owner branch. */
  ownerType: "user";
  /** User represented by the key. */
  user: User;
}

/** Successful authentication for a workspace-owned API key. */
export interface WorkspaceApiKeyValidation<
  ApiKey extends BaseApiKey,
  Workspace extends BaseWorkspace,
> {
  /** Validated API-key entity. */
  apiKey: ApiKey;
  /** Identifies the polymorphic owner branch. */
  ownerType: "workspace";
  /** Workspace represented by the key. */
  workspace: Workspace;
}

/** Successful API-key authentication result. */
export type ApiKeyValidation<
  ApiKey extends BaseApiKey,
  User extends BaseUser,
  Workspace extends BaseWorkspace,
> =
  | UserApiKeyValidation<ApiKey, User>
  | WorkspaceApiKeyValidation<ApiKey, Workspace>;

/** Domain service for user and workspace API-key lifecycle and authentication. */
@Injectable()
export class ApiKeyService<
  ApiKey extends BaseApiKey = BaseApiKey,
  User extends BaseUser = BaseUser,
  Workspace extends BaseWorkspace = BaseWorkspace,
> {
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
    this.accessControlService.assertUserCan("read", this.apiKeyEntity);
    return await this.getOwnedApiKey(id, user);
  }

  /** Returns a key owned by the authenticated workspace and within the caller's scope. */
  async getWorkspaceApiKey(
    id: string,
    workspace: Workspace,
  ): Promise<ApiKey | null> {
    this.assertWorkspacePrincipal(workspace);
    this.accessControlService.assertWorkspaceCan("read", this.apiKeyEntity);
    return await this.getOwnedApiKey(id, workspace);
  }

  /** Builds a filter for the current user's API keys. */
  getUserListFilter(user: User): FilterQuery<ApiKey> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("read", this.apiKeyEntity);
    return this.getOwnedListFilter(user);
  }

  /** Builds an ownership and permission-ceiling filter for workspace keys. */
  getWorkspaceListFilter(workspace: Workspace): FilterQuery<ApiKey> {
    this.assertWorkspacePrincipal(workspace);
    this.accessControlService.assertWorkspaceCan("read", this.apiKeyEntity);
    return this.getOwnedListFilter(workspace);
  }

  /** Creates an API key owned by a user. */
  async createUserKey(
    user: User,
    options: CreateApiKeyOptions,
  ): Promise<CreatedApiKey<ApiKey>> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("create", this.apiKeyEntity);
    const permissions = this.normalizeCreatePermissions(user, options);
    this.assertUserPermissionCeiling(user, permissions);
    return await this.createKey(user, options, permissions);
  }

  /** Creates an API key owned by a workspace. */
  async createWorkspaceKey(
    workspace: Workspace,
    options: CreateApiKeyOptions,
  ): Promise<CreatedApiKey<ApiKey>> {
    this.assertWorkspacePrincipal(workspace);
    this.accessControlService.assertWorkspaceCan("create", this.apiKeyEntity);
    const permissions = this.normalizeCreatePermissions(workspace, options);
    this.accessControlService.assertCanGrantWorkspacePermissions(permissions);
    return await this.createKey(workspace, options, permissions);
  }

  /** Updates an API key owned by the current user. */
  async updateUserKey(
    id: string,
    user: User,
    input: UpdateApiKeyOptions,
  ): Promise<ApiKey> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("update", this.apiKeyEntity);
    const apiKey = await this.findOwnedApiKey(id, user);
    const permissions = this.normalizeUpdatedPermissions(apiKey, input);
    const finalPermissions =
      permissions ?? this.normalizePermissions(user, apiKey.permissions ?? []);
    this.assertUserPermissionCeiling(user, finalPermissions);
    return await this.updateKey(apiKey, input, permissions);
  }

  /** Updates a key owned by the authenticated workspace. */
  async updateWorkspaceKey(
    id: string,
    workspace: Workspace,
    input: UpdateApiKeyOptions,
  ): Promise<ApiKey> {
    this.assertWorkspacePrincipal(workspace);
    this.accessControlService.assertWorkspaceCan("update", this.apiKeyEntity);
    const apiKey = await this.findOwnedApiKey(id, workspace);
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
  async deleteUserKey(id: string, user: User): Promise<ApiKey> {
    this.accessControlService.assertCurrentUser(user);
    this.accessControlService.assertUserCan("delete", this.apiKeyEntity);
    return await this.deleteKey(await this.findOwnedApiKey(id, user));
  }

  /** Deletes a key owned by the authenticated workspace. */
  async deleteWorkspaceKey(id: string, workspace: Workspace): Promise<ApiKey> {
    this.assertWorkspacePrincipal(workspace);
    this.accessControlService.assertWorkspaceCan("delete", this.apiKeyEntity);
    return await this.deleteKey(await this.findOwnedApiKey(id, workspace));
  }

  /** Validates a plaintext API key and resolves its polymorphic owner. */
  async validate(
    apiKey: string,
  ): Promise<ApiKeyValidation<ApiKey, User, Workspace>> {
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
    await this.runUnrestricted(() => this.em.flush());
    return apiKey;
  }

  /** Runs a service-authorized API-key persistence operation without RLS. */
  async runUnrestricted<T>(callback: () => Promise<T>): Promise<T> {
    const run = () => {
      RowLevelSecurity.setMode(RowLevelSecurityMode.DISABLED);
      return callback();
    };
    if (RequestContext.isActive()) return await RequestContext.child(run);
    return await RequestContext.run(
      new RequestContext({ type: "api-key-persistence" }),
      run,
    );
  }

  private async findOne(where: FilterQuery<ApiKey>): Promise<ApiKey | null> {
    return await this.runUnrestricted(
      async () =>
        await this.em.findOne(this.apiKeyEntity, where, {
          populate: ["owner"] as never,
        }),
    );
  }

  private async createKey(
    owner: User | Workspace,
    options: CreateApiKeyOptions,
    permissions: string[],
  ): Promise<CreatedApiKey<ApiKey>> {
    if (options.expiresAt && options.expiresAt <= new Date()) {
      throw new BadRequestException("API key expiration must be in the future");
    }
    const prefix = options.prefix ?? process.env.API_KEY_PREFIX ?? "sk";
    this.assertValidPrefix(prefix);
    const plaintextApiKey = `${prefix}${randomBytes(48).toString("base64url")}`;
    const entity = this.em.create(this.apiKeyEntity, {
      enabled: true,
      expiresAt: options.expiresAt ?? null,
      key: this.hashApiKey(plaintextApiKey),
      name: options.name,
      owner,
      permissions,
      prefix,
      start: plaintextApiKey.slice(0, 8),
    } as RequiredEntityData<ApiKey>);

    await this.runUnrestricted(() => this.em.persist(entity).flush());
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
    await this.runUnrestricted(() => this.em.flush());
    return apiKey;
  }

  private async deleteKey(apiKey: ApiKey): Promise<ApiKey> {
    this.em.remove(apiKey);
    await this.runUnrestricted(() => this.em.flush());
    return apiKey;
  }

  private async getOwnedApiKey(
    id: string,
    owner: User | Workspace,
  ): Promise<ApiKey | null> {
    const apiKey = await this.findOne({ id } as FilterQuery<ApiKey>);
    if (apiKey) {
      this.assertOwner(apiKey, owner);
      this.assertDelegatedApiKeyPermissionCeiling(apiKey.permissions ?? []);
    }
    return apiKey;
  }

  private async findOwnedApiKey(
    id: string,
    owner: User | Workspace,
  ): Promise<ApiKey> {
    const apiKey = await this.getOwnedApiKey(id, owner);
    if (!apiKey) throw new NotFoundException("API key not found");
    return apiKey;
  }

  private getOwnedListFilter(owner: User | Workspace): FilterQuery<ApiKey> {
    const apiKey = this.getAuthenticatingApiKey();
    return {
      owner,
      ...(apiKey
        ? { permissions: { $contained: apiKey.permissions ?? [] } }
        : {}),
    } as unknown as FilterQuery<ApiKey>;
  }

  private assertWorkspacePrincipal(workspace: Workspace): void {
    this.accessControlService.assertCurrentWorkspace(workspace);
    const apiKey = this.getAuthenticatingApiKey();
    if (
      apiKey &&
      this.getOwnerType(this.unwrapOwner(apiKey as ApiKey)) === "workspace"
    ) {
      this.assertOwner(apiKey as ApiKey, workspace);
      return;
    }
    const member = RequestContext.get(BaseWorkspaceMember);
    if (member?.status !== "ACTIVE") {
      throw new ForbiddenException("An active workspace member is required");
    }
    this.accessControlService.assertCurrentWorkspaceMember(member);
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
  ): Promise<ApiKeyValidation<ApiKey, User, Workspace> | null> {
    return await this.runUnrestricted(async () => {
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
    });
  }

  private getOwnerType(owner: User | Workspace): "user" | "workspace" {
    if (owner instanceof this.userEntity) return "user";
    if (owner instanceof this.workspaceEntity) return "workspace";
    throw new TypeError("Unsupported API key owner type");
  }

  private unwrapOwner(apiKey: ApiKey): User | Workspace {
    return Reference.unwrapReference(apiKey.owner as never) as unknown as
      | User
      | Workspace;
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

  private getAuthenticatingApiKey(): BaseApiKey | null {
    return RequestContext.isActive()
      ? (RequestContext.get(BaseApiKey) ?? null)
      : null;
  }

  private assertDelegatedApiKeyPermissionCeiling(
    permissions: readonly string[],
  ): void {
    const apiKey = this.getAuthenticatingApiKey();
    if (!apiKey) return;

    this.assertPermissionCeiling(
      permissions,
      apiKey.permissions ?? [],
      "API key permissions exceed authenticating API key permissions",
    );
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

  private get apiKeyEntity(): EntityClass<ApiKey> {
    return this.authOptions.entities.apiKey as EntityClass<ApiKey>;
  }

  private get userEntity(): EntityClass<User> {
    return this.authOptions.entities.user as EntityClass<User>;
  }

  private get workspaceEntity(): EntityClass<Workspace> {
    return this.authOptions.entities.workspace as EntityClass<Workspace>;
  }
}
