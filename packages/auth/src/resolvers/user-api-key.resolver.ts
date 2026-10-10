import { Args, ID, Mutation, Query, Resolver } from "@nest-boot/graphql";

import { CurrentUser } from "../decorators/current-user.decorator.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { CreateUserApiKeyInput } from "../inputs/create-user-api-key.input.js";
import { UpdateUserApiKeyInput } from "../inputs/update-user-api-key.input.js";
import { CreateUserApiKeyResult } from "../objects/create-user-api-key-result.object.js";
import { UserApiKeyPermissionOption } from "../objects/user-api-key-permission-option.object.js";
import { UserApiKeyService } from "../services/user-api-key.service.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";

/** GraphQL mutations for user-owned API keys. */
@Resolver(() => UserApiKey)
export class UserApiKeyResolver {
  /**
   * Creates the user API-key resolver.
   * @param apiKeyService - Service for validating or managing API keys.
   */
  constructor(
    /** User API-key domain service. */
    readonly apiKeyService: UserApiKeyService,
  ) {}

  /**
   * Lists permission choices for keys owned by the current user.
   * @param user - The user whose account is being accessed.
   * @returns Permission choices and grant availability for user API keys.
   */
  @Query(() => [UserApiKeyPermissionOption])
  userApiKeyPermissions(
    @CurrentUser() user: User,
  ): UserApiKeyPermissionOption[] {
    return this.apiKeyService.getUserApiKeyPermissions(user);
  }

  /**
   * Creates a credential and returns its plaintext once.
   * @param input - Requested field values for the operation.
   * @param user - The user whose account is being accessed.
   * @returns Created key metadata and its one-time plaintext credential.
   */
  @Mutation(() => CreateUserApiKeyResult)
  async createUserApiKey(
    @Args("input") input: CreateUserApiKeyInput,
    @CurrentUser() user: User,
  ): Promise<CreateUserApiKeyResult> {
    return await this.apiKeyService.createUserApiKey(user, input);
  }

  /**
   * Updates a credential owned by the current user.
   * @param id - Identifier of the record to access.
   * @param input - Requested field values for the operation.
   * @returns Updated API key metadata without the stored credential hash.
   */
  @Mutation(() => UserApiKey)
  async updateUserApiKey(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateUserApiKeyInput,
  ): Promise<ApiKeyMetadata<UserApiKey>> {
    return await this.apiKeyService.updateUserApiKey(id, input);
  }

  /**
   * Deletes a credential owned by the current user.
   * @param id - Identifier of the record to access.
   * @returns Deleted API key metadata without the stored credential hash.
   */
  @Mutation(() => UserApiKey)
  async deleteUserApiKey(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ApiKeyMetadata<UserApiKey>> {
    return await this.apiKeyService.deleteUserApiKey(id);
  }
}
