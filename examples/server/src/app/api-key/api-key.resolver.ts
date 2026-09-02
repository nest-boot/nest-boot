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
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator.js';
import { CurrentWorkspaceMember } from '../../common/decorators/current-workspace-member.decorator.js';
import { Workspace } from '../workspace/workspace.entity.js';
import { WorkspaceMemberRole } from '../workspace-member/enums/workspace-member-role.enum.js';
import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { WorkspaceMemberService } from '../workspace-member/workspace-member.service.js';
import {
  ApiKeyConnection,
  ApiKeyConnectionArgs,
} from './api-key.connection-definition.js';
import { ApiKey } from './api-key.entity.js';
import { ApiKeyService } from './api-key.service.js';
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
   * @param workspaceMemberService - 工作区成员查询服务。
   * @param cm - GraphQL 连接分页管理器。
   */
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly workspaceMemberService: WorkspaceMemberService,
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
    const apiKey = await this.apiKeyService.findOne({ id });

    if (!apiKey) {
      return null;
    }

    await this.assertCanAccessApiKey(currentWorkspaceMember, apiKey);

    return apiKey;
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
    const where = this.canManageWorkspaceApiKeys(workspaceMember)
      ? { workspace }
      : { workspace, member: workspaceMember };

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
    const member = await this.resolveTargetMember(
      workspace,
      currentWorkspaceMember,
      input.workspaceMemberId,
    );

    const result = await this.apiKeyService.createKey(member, {
      name: input.name,
      expiresAt: input.expiresAt ?? null,
    });

    return result;
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
    const apiKey = await this.findAccessibleApiKey(id, currentWorkspaceMember);

    return await this.apiKeyService.updateName(apiKey, input.name);
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
    const apiKey = await this.findAccessibleApiKey(id, currentWorkspaceMember);

    return await this.apiKeyService.remove(apiKey);
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

  private async resolveTargetMember(
    workspace: Workspace,
    currentWorkspaceMember: WorkspaceMember,
    workspaceMemberId?: string,
  ) {
    if (!workspaceMemberId || workspaceMemberId === currentWorkspaceMember.id) {
      return currentWorkspaceMember;
    }

    if (!this.canManageWorkspaceApiKeys(currentWorkspaceMember)) {
      throw new ForbiddenException(
        'You are not allowed to create API keys for other members',
      );
    }

    return await this.workspaceMemberService.findOneOrFail({
      id: workspaceMemberId,
      workspace,
    });
  }

  private async findAccessibleApiKey(
    id: string,
    currentWorkspaceMember: WorkspaceMember,
  ) {
    const apiKey = await this.apiKeyService.findOne({ id });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.assertCanAccessApiKey(currentWorkspaceMember, apiKey);

    return apiKey;
  }

  private async assertCanAccessApiKey(
    currentWorkspaceMember: WorkspaceMember,
    apiKey: ApiKey,
  ) {
    const member = await apiKey.member.loadOrFail();

    if (
      member.id !== currentWorkspaceMember.id &&
      !this.canManageWorkspaceApiKeys(currentWorkspaceMember)
    ) {
      throw new ForbiddenException(
        'You are not allowed to access this API key',
      );
    }
  }

  private canManageWorkspaceApiKeys(workspaceMember: WorkspaceMember) {
    return [WorkspaceMemberRole.ADMIN, WorkspaceMemberRole.OWNER].includes(
      workspaceMember.role,
    );
  }
}
