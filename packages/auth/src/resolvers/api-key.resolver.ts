import { Args, ID, Mutation, Resolver } from "@nest-boot/graphql";

import { CurrentUser } from "../decorators/current-user.decorator.js";
import { CurrentWorkspace } from "../decorators/current-workspace.decorator.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { CreateApiKeyInput } from "../inputs/create-api-key.input.js";
import { UpdateApiKeyInput } from "../inputs/update-api-key.input.js";
import { CreateApiKeyResult } from "../objects/create-api-key-result.object.js";
import { ApiKeyService } from "../services/api-key.service.js";

/**
 * GraphQL operations for creating, updating, and deleting API keys.
 */
@Resolver(() => ApiKey)
export class ApiKeyResolver {
  /**
   * Creates the API key resolver.
   *
   * @param apiKeyService - API key domain service.
   */
  constructor(readonly apiKeyService: ApiKeyService) {}

  /**
   * Creates an API key for the current workspace.
   *
   * @param input - Input for creating an API key.
   * @param workspace - Current workspace.
   * @returns Created entity and the plaintext API key, returned only once.
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
   * Updates an API key accessible to the current identity.
   *
   * @param id - API key identifier.
   * @param input - Input for updating an API key.
   * @returns Updated API key.
   */
  @Mutation(() => ApiKey)
  async updateWorkspaceApiKey(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateApiKeyInput,
  ): Promise<ApiKey> {
    return await this.apiKeyService.updateWorkspaceApiKey(id, input);
  }

  /**
   * Deletes an API key accessible to the current identity.
   *
   * @param id - API key identifier.
   * @returns Deleted API key.
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
