import { Args, ID, Mutation, Resolver } from "@nest-boot/graphql";

import { CurrentUser } from "../decorators/current-user.decorator.js";
import { CurrentWorkspace } from "../decorators/current-workspace.decorator.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { CreateApiKeyInput } from "../inputs/create-api-key.input.js";
import { UpdateApiKeyInput } from "../inputs/update-api-key.input.js";
import { ApiKeyService } from "../services/api-key.service.js";
import { CreateApiKeyResult } from "../types/create-api-key-result.type.js";

/**
 * 提供 API Key 的创建、更新和删除 GraphQL 接口。
 */
@Resolver(() => ApiKey)
export class ApiKeyResolver {
  /**
   * 创建 API Key Resolver。
   *
   * @param apiKeyService - API Key 业务服务。
   */
  constructor(readonly apiKeyService: ApiKeyService) {}

  /**
   * 为当前工作区创建 API Key。
   *
   * @param input - 创建 API Key 的输入参数。
   * @param workspace - 当前工作区。
   * @returns 创建结果，包含实体和仅返回一次的明文 API Key。
   */
  @Mutation(() => CreateApiKeyResult)
  async createWorkspaceApiKey(
    @Args("input") input: CreateApiKeyInput,
    @CurrentWorkspace() workspace: Workspace,
  ): Promise<CreateApiKeyResult> {
    return await this.apiKeyService.createWorkspaceApiKey(workspace, {
      ...input,
      expiresAt: input.expiresAt ?? null,
    });
  }

  /**
   * 更新当前身份可访问 API Key 的显示名称。
   *
   * @param id - API Key 标识。
   * @param input - 更新 API Key 的输入参数。
   * @returns 更新后的 API Key。
   */
  @Mutation(() => ApiKey)
  async updateWorkspaceApiKey(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateApiKeyInput,
  ): Promise<ApiKey> {
    return await this.apiKeyService.updateWorkspaceApiKey(id, input);
  }

  /**
   * 删除当前身份可访问的 API Key。
   *
   * @param id - API Key 标识。
   * @returns 已删除的 API Key。
   */
  @Mutation(() => ApiKey)
  async deleteWorkspaceApiKey(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ApiKey> {
    return await this.apiKeyService.deleteWorkspaceApiKey(id);
  }

  /** Creates an API key owned by the authenticated user. */
  @Mutation(() => CreateApiKeyResult)
  async createUserApiKey(
    @Args("input") input: CreateApiKeyInput,
    @CurrentUser() user: User,
  ): Promise<CreateApiKeyResult> {
    return await this.apiKeyService.createUserApiKey(user, {
      ...input,
      expiresAt: input.expiresAt ?? null,
    });
  }

  /** Updates an API key owned by the authenticated user. */
  @Mutation(() => ApiKey)
  async updateUserApiKey(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateApiKeyInput,
  ): Promise<ApiKey> {
    return await this.apiKeyService.updateUserApiKey(id, input);
  }

  /** Deletes an API key owned by the authenticated user. */
  @Mutation(() => ApiKey)
  async deleteUserApiKey(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ApiKey> {
    return await this.apiKeyService.deleteUserApiKey(id);
  }
}
