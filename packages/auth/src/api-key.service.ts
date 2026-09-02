import { randomBytes, timingSafeEqual } from "node:crypto";

import {
  type EntityClass,
  EntityManager,
  type FilterQuery,
  type RequiredEntityData,
} from "@mikro-orm/core";
import { CryptService } from "@nest-boot/crypt";
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
  AuthApiKeyEntity,
  AuthWorkspaceEntity,
  AuthWorkspaceMemberEntity,
} from "./interfaces/auth-entities.interface.js";

/** Input accepted when creating an API key. */
export interface CreateApiKeyOptions {
  /** API-key display name. */
  name: string;
  /** Optional expiration timestamp. */
  expiresAt?: Date | null;
  /** Member to represent; defaults to the current workspace member. */
  workspaceMemberId?: string;
}

/** API-key creation result. The plaintext key is returned only once. */
export interface CreatedApiKey<ApiKey extends AuthApiKeyEntity> {
  /** Persisted API-key entity. */
  entity: ApiKey;
  /** Plaintext API key. */
  apiKey: string;
}

/** Successful API-key authentication result. */
export interface ApiKeyValidation<
  ApiKey extends AuthApiKeyEntity,
  Workspace extends AuthWorkspaceEntity,
  WorkspaceMember extends AuthWorkspaceMemberEntity,
> {
  /** Validated API-key entity. */
  apiKey: ApiKey;
  /** Workspace represented by the key. */
  workspace: Workspace;
  /** Workspace member represented by the key. */
  workspaceMember: WorkspaceMember;
}

interface ParsedApiKey {
  keyId: string;
  prefix: string;
  secret: string;
}

interface ApiKeyValidationRow<
  ApiKey extends AuthApiKeyEntity,
  Workspace extends AuthWorkspaceEntity,
  WorkspaceMember extends AuthWorkspaceMemberEntity,
> extends ApiKeyValidation<ApiKey, Workspace, WorkspaceMember> {
  expiresAt: Date | string | null;
  memberStatus: AuthWorkspaceMemberEntity["status"];
}

/** Domain service for API-key lifecycle, access control, and authentication. */
@Injectable()
export class ApiKeyService<
  ApiKey extends AuthApiKeyEntity = AuthApiKeyEntity,
  Workspace extends AuthWorkspaceEntity = AuthWorkspaceEntity,
  WorkspaceMember extends AuthWorkspaceMemberEntity = AuthWorkspaceMemberEntity,
> {
  private readonly logger = new Logger(ApiKeyService.name);

  /** Creates an API-key domain service. */
  constructor(
    /** MikroORM entity manager used for API-key persistence. */
    protected readonly em: EntityManager,
    private readonly cryptService: CryptService,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
  ) {}

  private async findOne(where: FilterQuery<ApiKey>): Promise<ApiKey | null> {
    return await this.em.findOne(this.apiKeyEntity, where);
  }

  /** Returns an API key when the current member may access it. */
  async getApiKey(
    id: string,
    currentWorkspaceMember: WorkspaceMember,
  ): Promise<ApiKey | null> {
    const apiKey = await this.findOne({ id } as FilterQuery<ApiKey>);

    if (apiKey) {
      await this.assertCanAccessApiKey(currentWorkspaceMember, apiKey);
    }

    return apiKey;
  }

  /** Builds the workspace-scoped filter used to list accessible API keys. */
  getListFilter(
    workspace: Workspace,
    currentWorkspaceMember: WorkspaceMember,
  ): FilterQuery<ApiKey> {
    this.assertWorkspaceMembership(workspace, currentWorkspaceMember);

    return (this.canManageWorkspaceApiKeys(currentWorkspaceMember)
      ? { workspace }
      : {
          member: currentWorkspaceMember,
          workspace,
        }) as unknown as FilterQuery<ApiKey>;
  }

  /** Creates an API key for the current or an administratively selected member. */
  async createKey(
    workspace: Workspace,
    currentWorkspaceMember: WorkspaceMember,
    options: CreateApiKeyOptions,
  ): Promise<CreatedApiKey<ApiKey>> {
    this.assertWorkspaceMembership(workspace, currentWorkspaceMember);

    const member = await this.resolveTargetMember(
      workspace,
      currentWorkspaceMember,
      options.workspaceMemberId,
    );

    if (member.status !== "ACTIVE") {
      throw new BadRequestException(
        "Cannot create API key for inactive member",
      );
    }

    if (options.expiresAt && options.expiresAt <= new Date()) {
      throw new BadRequestException("API key expiration must be in the future");
    }

    const keyPrefix = process.env.API_KEY_PREFIX ?? "sk-";
    const keyId = randomBytes(8).toString("hex");
    const secret = randomBytes(8).toString("hex");
    const plaintextApiKey = `${keyPrefix}${keyId}${secret}`;
    const encryptedSecret = await this.cryptService.encrypt(secret);
    const entity = this.em.create(this.apiKeyEntity, {
      encryptedSecret,
      expiresAt: options.expiresAt ?? null,
      keyId,
      keyPrefix,
      member,
      name: options.name,
      workspace,
    } as RequiredEntityData<ApiKey>);

    await this.em.persist(entity).flush();
    this.logger.log("API key created", {
      apiKeyId: entity.id,
      workspaceMemberId: member.id,
    });

    return { apiKey: plaintextApiKey, entity };
  }

  /** Updates an accessible API key. */
  async updateKey(
    id: string,
    currentWorkspaceMember: WorkspaceMember,
    input: { name?: string },
  ): Promise<ApiKey> {
    const apiKey = await this.findAccessibleApiKey(id, currentWorkspaceMember);

    if (input.name !== undefined) {
      apiKey.name = input.name;
    }

    await this.em.flush();
    return apiKey;
  }

  /** Deletes an accessible API key. */
  async deleteKey(
    id: string,
    currentWorkspaceMember: WorkspaceMember,
  ): Promise<ApiKey> {
    const apiKey = await this.findAccessibleApiKey(id, currentWorkspaceMember);

    this.em.remove(apiKey);
    await this.em.flush();
    return apiKey;
  }

  /** Validates a plaintext API key and resolves its workspace identity. */
  async validate(
    apiKey: string,
  ): Promise<ApiKeyValidation<ApiKey, Workspace, WorkspaceMember>> {
    if (!apiKey) {
      throw new UnauthorizedException("Missing API key");
    }

    const parsedApiKey = this.parseApiKey(apiKey);
    if (!parsedApiKey) {
      throw new UnauthorizedException("Invalid API key");
    }

    const row = await this.findValidationRow(parsedApiKey);
    if (!row) {
      throw new UnauthorizedException("Invalid API key");
    }

    if (row.expiresAt && new Date(row.expiresAt) <= new Date()) {
      throw new UnauthorizedException("API key has expired");
    }

    if (row.memberStatus !== "ACTIVE") {
      throw new UnauthorizedException("Workspace member is not active");
    }

    return {
      apiKey: row.apiKey,
      workspace: row.workspace,
      workspaceMember: row.workspaceMember,
    };
  }

  /** Records the last successful use of an API key. */
  async recordUsage(apiKey: ApiKey): Promise<ApiKey> {
    const now = new Date();
    apiKey.lastUsedAt = now;
    apiKey.updatedAt = now;
    await this.em.flush();
    return apiKey;
  }

  private async resolveTargetMember(
    workspace: Workspace,
    currentWorkspaceMember: WorkspaceMember,
    workspaceMemberId?: string,
  ): Promise<WorkspaceMember> {
    if (!workspaceMemberId || workspaceMemberId === currentWorkspaceMember.id) {
      return currentWorkspaceMember;
    }

    if (!this.canManageWorkspaceApiKeys(currentWorkspaceMember)) {
      throw new ForbiddenException(
        "You are not allowed to create API keys for other members",
      );
    }

    const member = await this.em.findOne(this.workspaceMemberEntity, {
      id: workspaceMemberId,
      workspace,
    } as FilterQuery<WorkspaceMember>);

    if (!member) {
      throw new NotFoundException("Workspace member not found");
    }

    return member;
  }

  private async findAccessibleApiKey(
    id: string,
    currentWorkspaceMember: WorkspaceMember,
  ): Promise<ApiKey> {
    const apiKey = await this.findOne({ id } as FilterQuery<ApiKey>);
    if (!apiKey) {
      throw new NotFoundException("API key not found");
    }

    await this.assertCanAccessApiKey(currentWorkspaceMember, apiKey);
    return apiKey;
  }

  private async assertCanAccessApiKey(
    currentWorkspaceMember: WorkspaceMember,
    apiKey: ApiKey,
  ): Promise<void> {
    const member = (await apiKey.member.loadOrFail()) as WorkspaceMember;

    if (
      apiKey.workspace.id !== currentWorkspaceMember.workspace.id ||
      (member.id !== currentWorkspaceMember.id &&
        !this.canManageWorkspaceApiKeys(currentWorkspaceMember))
    ) {
      throw new ForbiddenException(
        "You are not allowed to access this API key",
      );
    }
  }

  private canManageWorkspaceApiKeys(member: WorkspaceMember): boolean {
    return member.role === "ADMIN" || member.role === "OWNER";
  }

  private assertWorkspaceMembership(
    workspace: Workspace,
    member: WorkspaceMember,
  ): void {
    if (member.workspace.id !== workspace.id) {
      throw new ForbiddenException(
        "Workspace member does not belong to this workspace",
      );
    }
  }

  private parseApiKey(apiKey: string): ParsedApiKey | null {
    const suffix = apiKey.slice(-32);
    if (!/^[0-9a-f]{32}$/.test(suffix)) {
      return null;
    }

    return {
      keyId: suffix.slice(0, 16),
      prefix: apiKey.slice(0, -32),
      secret: suffix.slice(16),
    };
  }

  private async findValidationRow(
    parsedApiKey: ParsedApiKey,
  ): Promise<ApiKeyValidationRow<ApiKey, Workspace, WorkspaceMember> | null> {
    return await this.withRlsDisabled(async () => {
      const entity = await this.findOne({
        keyId: parsedApiKey.keyId,
      } as FilterQuery<ApiKey>);
      if (!entity) {
        return null;
      }

      if (entity.keyPrefix !== parsedApiKey.prefix) {
        return null;
      }

      let secret: string;
      try {
        secret = await this.cryptService.decrypt(entity.encryptedSecret);
      } catch {
        return null;
      }
      if (!this.secretsEqual(secret, parsedApiKey.secret)) {
        return null;
      }

      const workspaceMember = await this.em.findOne(
        this.workspaceMemberEntity,
        {
          id: entity.member.id,
          workspace: { id: entity.workspace.id },
        } as FilterQuery<WorkspaceMember>,
      );
      if (!workspaceMember) {
        return null;
      }

      const workspace = await this.em.findOne(this.workspaceEntity, {
        deletedAt: null,
        id: entity.workspace.id,
      } as FilterQuery<Workspace>);
      if (!workspace) {
        return null;
      }

      return {
        apiKey: entity,
        expiresAt: entity.expiresAt ?? null,
        memberStatus: workspaceMember.status,
        workspace,
        workspaceMember,
      };
    });
  }

  private secretsEqual(actual: string, expected: string): boolean {
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);

    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }

  private get apiKeyEntity(): EntityClass<ApiKey> {
    return this.authOptions.entities.apiKey as EntityClass<ApiKey>;
  }

  private get workspaceEntity(): EntityClass<Workspace> {
    return this.authOptions.entities.workspace as EntityClass<Workspace>;
  }

  private get workspaceMemberEntity(): EntityClass<WorkspaceMember> {
    return this.authOptions.entities
      .workspaceMember as EntityClass<WorkspaceMember>;
  }

  private async withRlsDisabled<T>(callback: () => Promise<T>): Promise<T> {
    const run = () => {
      RowLevelSecurity.setMode(RowLevelSecurityMode.DISABLED);
      return callback();
    };

    if (RequestContext.isActive()) {
      return await RequestContext.child(run);
    }

    return await RequestContext.run(
      new RequestContext({ type: "api-key-validation" }),
      run,
    );
  }
}
