import {
  ApiKeyService,
  CurrentWorkspace,
  CurrentWorkspaceMember,
} from '@nest-boot/auth';
import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nest-boot/graphql';
import { ConnectionManager } from '@nest-boot/graphql-connection';

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
  async apiKey(
    @Args('id', { type: () => ID }) id: string,
    @CurrentWorkspaceMember() currentWorkspaceMember: WorkspaceMember,
  ): Promise<ApiKey | null> {
    return await this.apiKeyService.getApiKey(id, currentWorkspaceMember);
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
  async apiKeys(
    @Args() args: ApiKeyConnectionArgs,
    @CurrentWorkspace() workspace: Workspace,
    @CurrentWorkspaceMember() workspaceMember: WorkspaceMember,
  ): Promise<ApiKeyConnection> {
    const where = this.apiKeyService.getListFilter(workspace, workspaceMember);

    return await this.cm.find(ApiKeyConnection, args, { where });
  }

  /**
   * 为当前成员或有管理权限的目标成员创建 API Key。
   *
   * @param input - 创建 API Key 的输入参数。
   * @param workspace - 当前工作区。
   * @param currentWorkspaceMember - 当前请求的工作区成员。
   * @returns 创建结果，包含实体和仅返回一次的明文 API Key。
   */
  @Mutation(() => CreateApiKeyResult)
  async createApiKey(
    @Args('input') input: CreateApiKeyInput,
    @CurrentWorkspace() workspace: Workspace,
    @CurrentWorkspaceMember() currentWorkspaceMember: WorkspaceMember,
  ): Promise<CreateApiKeyResult> {
    return await this.apiKeyService.createKey(
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
  async updateApiKey(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateApiKeyInput,
    @CurrentWorkspaceMember() currentWorkspaceMember: WorkspaceMember,
  ): Promise<ApiKey> {
    return await this.apiKeyService.updateKey(
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
  async deleteApiKey(
    @Args('id', { type: () => ID }) id: string,
    @CurrentWorkspaceMember() currentWorkspaceMember: WorkspaceMember,
  ): Promise<ApiKey> {
    return await this.apiKeyService.deleteKey(id, currentWorkspaceMember);
  }

  /**
   * 解析 API Key 绑定的工作区成员字段。
   *
   * @param apiKey - 父级 API Key 实体。
   * @returns API Key 绑定的工作区成员。
   */
  @ResolveField(() => WorkspaceMember)
  async member(@Parent() apiKey: ApiKey): Promise<WorkspaceMember> {
    return await apiKey.member.loadOrFail();
  }
}
