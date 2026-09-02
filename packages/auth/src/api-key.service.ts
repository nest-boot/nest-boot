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

import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import type {
  BaseApiKey,
  BaseUser,
  BaseWorkspace,
  BaseWorkspaceMember,
} from "./entities/index.js";

/** Input accepted when creating an API key. */
export interface CreateApiKeyOptions {
  /** API-key display name. */
  name: string;
  /** Optional expiration timestamp. */
  expiresAt?: Date | null;
  /** Operations that this API key may perform. */
  permissions?: string[] | null;
  /** Plaintext prefix prepended to the generated key. */
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
  /** Operations that this API key may perform. */
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
  WorkspaceMember extends BaseWorkspaceMember = BaseWorkspaceMember,
> {
  private readonly logger = new Logger(ApiKeyService.name);

  /** Creates an API-key domain service. */
  constructor(
    /** MikroORM entity manager used for API-key persistence. */
    protected readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
  ) {}

  /** Returns a user-owned API key when it belongs to the current user. */
  async getUserApiKey(id: string, user: User): Promise<ApiKey | null> {
    return await this.getOwnedApiKey(id, user);
  }

  /** Returns a workspace-owned API key when the member may manage it. */
  async getWorkspaceApiKey(
    id: string,
    member: WorkspaceMember,
  ): Promise<ApiKey | null> {
    const apiKey = await this.findOne({ id } as FilterQuery<ApiKey>);
    if (apiKey) {
      this.assertCanManageWorkspaceApiKey(member, apiKey);
    }
    return apiKey;
  }

  /** Builds a filter for the current user's API keys. */
  getUserListFilter(user: User): FilterQuery<ApiKey> {
    return { owner: user } as unknown as FilterQuery<ApiKey>;
  }

  /** Builds a filter for workspace keys manageable by the current member. */
  getWorkspaceListFilter(
    workspace: Workspace,
    member: WorkspaceMember,
  ): FilterQuery<ApiKey> {
    this.assertWorkspaceMembership(workspace, member);
    this.assertCanManageWorkspaceApiKeys(member);
    return { owner: workspace } as unknown as FilterQuery<ApiKey>;
  }

  /** Creates an API key owned by a user. */
  async createUserKey(
    user: User,
    options: CreateApiKeyOptions,
  ): Promise<CreatedApiKey<ApiKey>> {
    return await this.createKey(user, options);
  }

  /** Creates an API key owned by a workspace. */
  async createWorkspaceKey(
    workspace: Workspace,
    member: WorkspaceMember,
    options: CreateApiKeyOptions,
  ): Promise<CreatedApiKey<ApiKey>> {
    this.assertWorkspaceMembership(workspace, member);
    this.assertCanManageWorkspaceApiKeys(member);
    if (member.status !== "ACTIVE") {
      throw new BadRequestException(
        "Cannot create API key for inactive member",
      );
    }
    return await this.createKey(workspace, options);
  }

  /** Updates an API key owned by the current user. */
  async updateUserKey(
    id: string,
    user: User,
    input: UpdateApiKeyOptions,
  ): Promise<ApiKey> {
    return await this.updateKey(await this.findOwnedApiKey(id, user), input);
  }

  /** Updates a workspace API key manageable by the current member. */
  async updateWorkspaceKey(
    id: string,
    member: WorkspaceMember,
    input: UpdateApiKeyOptions,
  ): Promise<ApiKey> {
    return await this.updateKey(
      await this.findManageableWorkspaceApiKey(id, member),
      input,
    );
  }

  /** Deletes an API key owned by the current user. */
  async deleteUserKey(id: string, user: User): Promise<ApiKey> {
    return await this.deleteKey(await this.findOwnedApiKey(id, user));
  }

  /** Deletes a workspace API key manageable by the current member. */
  async deleteWorkspaceKey(
    id: string,
    member: WorkspaceMember,
  ): Promise<ApiKey> {
    return await this.deleteKey(
      await this.findManageableWorkspaceApiKey(id, member),
    );
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
  ): Promise<CreatedApiKey<ApiKey>> {
    if (options.expiresAt && options.expiresAt <= new Date()) {
      throw new BadRequestException("API key expiration must be in the future");
    }
    const prefix = options.prefix ?? process.env.API_KEY_PREFIX ?? "sk-";
    this.assertValidPrefix(prefix);
    this.assertValidPermissions(options.permissions);

    const plaintextApiKey = `${prefix}${randomBytes(48).toString("base64url")}`;
    const entity = this.em.create(this.apiKeyEntity, {
      enabled: true,
      expiresAt: options.expiresAt ?? null,
      key: this.hashApiKey(plaintextApiKey),
      name: options.name,
      owner,
      permissions: options.permissions ?? [],
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
  ): Promise<ApiKey> {
    if (input.expiresAt && input.expiresAt <= new Date()) {
      throw new BadRequestException("API key expiration must be in the future");
    }
    this.assertValidPermissions(input.permissions);
    if (input.name !== undefined) apiKey.name = input.name;
    if (input.enabled !== undefined) apiKey.enabled = input.enabled;
    if (input.expiresAt !== undefined) apiKey.expiresAt = input.expiresAt;
    if (input.permissions !== undefined) {
      apiKey.permissions = input.permissions ?? [];
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
    if (apiKey) this.assertOwner(apiKey, owner);
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

  private async findManageableWorkspaceApiKey(
    id: string,
    member: WorkspaceMember,
  ): Promise<ApiKey> {
    const apiKey = await this.findOne({ id } as FilterQuery<ApiKey>);
    if (!apiKey) throw new NotFoundException("API key not found");
    this.assertCanManageWorkspaceApiKey(member, apiKey);
    return apiKey;
  }

  private assertCanManageWorkspaceApiKey(
    member: WorkspaceMember,
    apiKey: ApiKey,
  ): void {
    const owner = this.unwrapOwner(apiKey);
    if (
      !(owner instanceof this.workspaceEntity) ||
      owner.id !== Reference.unwrapReference(member.workspace).id
    ) {
      throw new ForbiddenException(
        "You are not allowed to access this API key",
      );
    }
    this.assertCanManageWorkspaceApiKeys(member);
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

  private assertCanManageWorkspaceApiKeys(member: WorkspaceMember): void {
    if (member.role !== "OWNER") {
      throw new ForbiddenException(
        "You are not allowed to manage workspace API keys",
      );
    }
  }

  private assertWorkspaceMembership(
    workspace: Workspace,
    member: WorkspaceMember,
  ): void {
    if (Reference.unwrapReference(member.workspace).id !== workspace.id) {
      throw new ForbiddenException(
        "Workspace member does not belong to this workspace",
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
    if (prefix.length < 1 || prefix.length > 32) {
      throw new BadRequestException(
        "API key prefix must contain between 1 and 32 characters",
      );
    }
  }

  private assertValidPermissions(
    permissions: string[] | null | undefined,
  ): void {
    if (permissions == null) return;
    const isValid =
      Array.isArray(permissions) &&
      permissions.every(
        (permission) => typeof permission === "string" && permission.length > 0,
      );
    if (!isValid) {
      throw new BadRequestException(
        "API key permissions must contain non-empty strings",
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
