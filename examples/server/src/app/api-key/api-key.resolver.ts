import {
  ApiKeyService,
  Can,
  CurrentUser,
  CurrentWorkspace,
  CurrentWorkspaceMember,
} from '@nest-boot/auth';
import { Args, ID, Mutation, Query, Resolver } from '@nest-boot/graphql';
import { ConnectionManager } from '@nest-boot/graphql-connection';

import { User } from '../user/user.entity.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import {
  ApiKeyConnection,
  ApiKeyConnectionArgs,
} from './api-key.connection-definition.js';
import { ApiKey } from './api-key.entity.js';
import { CreateApiKeyInput } from './inputs/create-api-key.input.js';
import { UpdateApiKeyInput } from './inputs/update-api-key.input.js';
import { CreateApiKeyResult } from './types/create-api-key-result.type.js';

/**
 * 提供 API Key 的查询、创建、更新和吊销 GraphQL 接口。
 */
@Resolver(() => ApiKey)
export class ApiKeyResolver {
  /**
   * 创建 API Key Resolver。
   *
   * @param apiKeyService - API Key 业务服务。
   * @param cm - GraphQL 连接分页管理器。
   */
  constructor(
    private readonly apiKeyService: ApiKeyService<
      ApiKey,
      User,
      Workspace,
      WorkspaceMember
    >,
    private readonly cm: ConnectionManager,
  ) {}

  /**
   * 查询当前成员可访问的单个 API Key。
   *
   * @param id - API Key 标识。
   * @param currentWorkspaceMember - 当前请求的工作区成员。
   * @returns 可访问时返回 API Key，否则返回空值。
   */
  @Query(() => ApiKey, { nullable: true })
  @Can('read', ApiKey)
  async apiKey(
    @Args('id', { type: () => ID }) id: string,
    @CurrentWorkspaceMember() currentWorkspaceMember: WorkspaceMember,
  ): Promise<ApiKey | null> {
    return await this.apiKeyService.getWorkspaceApiKey(
      id,
      currentWorkspaceMember,
    );
  }

  /**
   * 分页查询当前成员可访问的 API Key 列表。
   *
   * @param args - 连接分页与过滤参数。
   * @param workspace - 当前工作区。
   * @param workspaceMember - 当前请求的工作区成员。
   * @returns API Key 连接分页结果。
   */
  @Query(() => ApiKeyConnection)
  @Can('read', ApiKey)
  async apiKeys(
    @Args() args: ApiKeyConnectionArgs,
    @CurrentWorkspace() workspace: Workspace,
    @CurrentWorkspaceMember() workspaceMember: WorkspaceMember,
  ): Promise<ApiKeyConnection> {
    const where = this.apiKeyService.getWorkspaceListFilter(
      workspace,
      workspaceMember,
    );

    return await this.apiKeyService.runUnrestricted(
      async () => await this.cm.find(ApiKeyConnection, args, { where }),
    );
  }

  /**
   * 为当前工作区创建 API Key。
   *
   * @param input - 创建 API Key 的输入参数。
   * @param workspace - 当前工作区。
   * @param currentWorkspaceMember - 当前请求的工作区成员。
   * @returns 创建结果，包含实体和仅返回一次的明文 API Key。
   */
  @Mutation(() => CreateApiKeyResult)
  @Can('create', ApiKey)
  async createApiKey(
    @Args('input') input: CreateApiKeyInput,
    @CurrentWorkspace() workspace: Workspace,
    @CurrentWorkspaceMember() currentWorkspaceMember: WorkspaceMember,
  ): Promise<CreateApiKeyResult> {
    return await this.apiKeyService.createWorkspaceKey(
      workspace,
      currentWorkspaceMember,
      {
        ...input,
        expiresAt: input.expiresAt ?? null,
      },
    );
  }

  /**
   * 更新当前成员可访问 API Key 的显示名称。
   *
   * @param id - API Key 标识。
   * @param input - 更新 API Key 的输入参数。
   * @param currentWorkspaceMember - 当前请求的工作区成员。
   * @returns 更新后的 API Key。
   */
  @Mutation(() => ApiKey)
  @Can('update', ApiKey)
  async updateApiKey(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateApiKeyInput,
    @CurrentWorkspaceMember() currentWorkspaceMember: WorkspaceMember,
  ): Promise<ApiKey> {
    return await this.apiKeyService.updateWorkspaceKey(
      id,
      currentWorkspaceMember,
      input,
    );
  }

  /**
   * 删除当前成员可访问的 API Key。
   *
   * @param id - API Key 标识。
   * @param currentWorkspaceMember - 当前请求的工作区成员.
   * @returns 已删除的 API Key。
   */
  @Mutation(() => ApiKey)
  @Can('delete', ApiKey)
  async deleteApiKey(
    @Args('id', { type: () => ID }) id: string,
    @CurrentWorkspaceMember() currentWorkspaceMember: WorkspaceMember,
  ): Promise<ApiKey> {
    return await this.apiKeyService.deleteWorkspaceKey(
      id,
      currentWorkspaceMember,
    );
  }

  /** Returns one API key owned by the authenticated user. */
  @Query(() => ApiKey, { nullable: true })
  @Can('read', ApiKey, { scope: 'user' })
  async userApiKey(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<ApiKey | null> {
    return await this.apiKeyService.getUserApiKey(id, user);
  }

  /** Lists API keys owned by the authenticated user. */
  @Query(() => ApiKeyConnection)
  @Can('read', ApiKey, { scope: 'user' })
  async userApiKeys(
    @Args() args: ApiKeyConnectionArgs,
    @CurrentUser() user: User,
  ): Promise<ApiKeyConnection> {
    return await this.apiKeyService.runUnrestricted(
      async () =>
        await this.cm.find(ApiKeyConnection, args, {
          where: this.apiKeyService.getUserListFilter(user),
        }),
    );
  }

  /** Creates an API key owned by the authenticated user. */
  @Mutation(() => CreateApiKeyResult)
  @Can('create', ApiKey, { scope: 'user' })
  async createUserApiKey(
    @Args('input') input: CreateApiKeyInput,
    @CurrentUser() user: User,
  ): Promise<CreateApiKeyResult> {
    return await this.apiKeyService.createUserKey(user, {
      ...input,
      expiresAt: input.expiresAt ?? null,
    });
  }

  /** Updates an API key owned by the authenticated user. */
  @Mutation(() => ApiKey)
  @Can('update', ApiKey, { scope: 'user' })
  async updateUserApiKey(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateApiKeyInput,
    @CurrentUser() user: User,
  ): Promise<ApiKey> {
    return await this.apiKeyService.updateUserKey(id, user, input);
  }

  /** Deletes an API key owned by the authenticated user. */
  @Mutation(() => ApiKey)
  @Can('delete', ApiKey, { scope: 'user' })
  async deleteUserApiKey(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<ApiKey> {
    return await this.apiKeyService.deleteUserKey(id, user);
  }
}
