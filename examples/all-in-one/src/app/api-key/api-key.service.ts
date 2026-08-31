import { EntityManager } from '@mikro-orm/postgresql';
import { CryptService } from '@nest-boot/crypt';
import { Logger } from '@nest-boot/logger';
import { EntityService } from '@nest-boot/mikro-orm';
import { RequestContext } from '@nest-boot/request-context';
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from '@nest-boot/row-level-security';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMemberStatus } from '../workspace-member/enums/workspace-member-status.enum.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service.js';
import { ApiKey } from './api-key.entity.js';

/**
 * 创建 API Key 时可配置的业务参数。
 */
export interface CreateApiKeyOptions {
  /** API Key 显示名称。 */
  name: string;
  /** API Key 过期时间，为空表示不过期。 */
  expiresAt?: Date | null;
}

/**
 * API Key 校验成功后的认证结果。
 */
export interface ApiKeyValidation {
  /** 匹配到的 API Key 实体。 */
  apiKey: ApiKey;
  /** API Key 绑定的工作区。 */
  workspace: Workspace;
  /** API Key 绑定的工作区成员。 */
  workspaceMember: WorkspaceMember;
}

/**
 * API Key 创建成功后的返回值。
 */
export interface CreatedApiKey {
  /** 创建成功后的 API Key 实体。 */
  entity: ApiKey;
  /** 仅返回一次的 API Key 明文。 */
  apiKey: string;
}

interface ApiKeyValidationRow {
  apiKey: ApiKey;
  workspace: Workspace;
  workspaceMember: WorkspaceMember;
  expiresAt: Date | string | null;
  memberStatus: WorkspaceMemberStatus;
}

interface ParsedApiKey {
  keyId: string;
  secret: string;
}

/**
 * 管理 API Key 的创建、校验、吊销和使用记录。
 */
@Injectable()
export class ApiKeyService extends EntityService<ApiKey> {
  /**
   * 创建 API Key 服务。
   *
   * @param em - 当前请求使用的 MikroORM `EntityManager`。
   * @param logger - 结构化日志服务。
   * @param configService - 应用配置服务。
   * @param workspaceMemberService - 工作区成员查询服务。
   */
  constructor(
    /** 当前请求使用的 MikroORM `EntityManager`。 */
    protected readonly em: EntityManager,
    private readonly logger: Logger,
    private readonly cryptService: CryptService,
    private readonly configService: ConfigService,
    private readonly workspaceMemberService: WorkspaceMemberService,
  ) {
    super(ApiKey, em);
    this.logger.setContext(ApiKeyService.name);
  }

  /**
   * 为指定工作区成员创建 API Key。
   *
   * @param member - API Key 绑定的工作区成员。
   * @param options - 创建 API Key 使用的业务参数。
   * @returns API Key 实体和仅返回一次的明文密钥。
   */
  async createKey(
    member: WorkspaceMember,
    options: CreateApiKeyOptions,
  ): Promise<CreatedApiKey> {
    if (member.status === WorkspaceMemberStatus.DISABLED) {
      throw new BadRequestException(
        'Cannot create API key for disabled member',
      );
    }

    if (options.expiresAt && options.expiresAt <= new Date()) {
      throw new BadRequestException('API key expiration must be in the future');
    }

    const keyPrefix = this.getKeyPrefix();
    const keyId = this.generateKeyId();
    const secret = this.generateSecret();
    const apiKey = this.assembleApiKey(keyPrefix, keyId, secret);
    const encryptedSecret = await this.cryptService.encrypt(secret);
    const entity = this.em.create(ApiKey, {
      name: options.name,
      keyId,
      keyPrefix,
      encryptedSecret,
      workspace: member.workspace,
      member,
      expiresAt: options.expiresAt ?? null,
    });

    await this.em.persist(entity).flush();

    this.logger.log('API key created', {
      apiKeyId: entity.id,
      workspaceMemberId: member.id,
    });

    return { entity, apiKey };
  }

  /**
   * 校验 API Key 明文并返回认证结果。
   *
   * @param apiKey - 请求中携带的 API Key 明文。
   * @returns 认证通过后对应的 API Key 和工作区成员。
   */
  async validate(apiKey: string): Promise<ApiKeyValidation> {
    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    const parsedApiKey = this.parseApiKey(apiKey);

    if (!parsedApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    const row = await this.findValidationRow(parsedApiKey);

    if (!row) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (row.expiresAt && new Date(row.expiresAt) <= new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    if (row.memberStatus === WorkspaceMemberStatus.DISABLED) {
      throw new UnauthorizedException('Workspace member is disabled');
    }

    return {
      apiKey: row.apiKey,
      workspace: row.workspace,
      workspaceMember: row.workspaceMember,
    };
  }

  /**
   * 更新 API Key 显示名称。
   *
   * @param apiKey - 要更新的 API Key 实体。
   * @param name - 新名称；未传入时保持原值。
   * @returns 更新后的 API Key 实体。
   */
  async updateName(apiKey: ApiKey, name?: string): Promise<ApiKey> {
    if (name !== undefined) {
      apiKey.name = name;
    }

    await this.em.flush();

    return apiKey;
  }

  /**
   * 记录 API Key 的最近使用时间。
   *
   * @param apiKey - 本次请求使用的 API Key 实体。
   * @returns 更新使用时间后的 API Key 实体。
   */
  async recordUsage(apiKey: ApiKey): Promise<ApiKey> {
    const now = new Date();

    apiKey.lastUsedAt = now;
    apiKey.updatedAt = now;

    await this.em.flush();

    return apiKey;
  }

  private getKeyPrefix() {
    return this.configService.get<string>('API_KEY_PREFIX', 'sk-');
  }

  private generateKeyId() {
    return randomBytes(8).toString('hex');
  }

  private generateSecret() {
    return randomBytes(8).toString('hex');
  }

  private assembleApiKey(prefix: string, keyId: string, secret: string) {
    return `${prefix}${keyId}${secret}`;
  }

  private parseApiKey(apiKey: string): ParsedApiKey | null {
    const suffix = apiKey.slice(-32);

    if (!/^[0-9a-f]{32}$/.test(suffix)) {
      return null;
    }

    return {
      keyId: suffix.slice(0, 16),
      secret: suffix.slice(16),
    };
  }

  private async findValidationRow(parsedApiKey: ParsedApiKey) {
    return await this.withRlsDisabled(async () => {
      const entity = await this.findByKeyId(parsedApiKey.keyId);

      if (!entity) {
        return null;
      }

      const secret = await this.cryptService.decrypt(entity.encryptedSecret);

      if (secret !== parsedApiKey.secret) {
        return null;
      }

      const member = await this.loadWorkspaceMember(
        entity.workspace.id,
        entity.member.id,
      );

      if (!member) {
        return null;
      }

      const workspace = await this.em.findOneOrFail(Workspace, {
        id: entity.workspace.id,
      });

      return {
        apiKey: entity,
        workspace,
        workspaceMember: member,
        expiresAt: entity.expiresAt ?? null,
        memberStatus: member.status,
      } satisfies ApiKeyValidationRow;
    });
  }

  private async findByKeyId(keyId: string): Promise<ApiKey | null> {
    return await this.findOne({
      keyId,
    });
  }

  private async loadWorkspaceMember(workspaceId: string, memberId: string) {
    return await this.workspaceMemberService.findOne({
      id: memberId,
      workspace: {
        id: workspaceId,
      },
    });
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
      new RequestContext({ type: 'api-key-validation' }),
      run,
    );
  }
}
