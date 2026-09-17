import { Args, ID, Mutation, Resolver } from "@nest-boot/graphql";

import { CurrentUser } from "../decorators/current-user.decorator.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { CreateUserApiKeyInput } from "../inputs/create-user-api-key.input.js";
import { UpdateUserApiKeyInput } from "../inputs/update-user-api-key.input.js";
import { CreateUserApiKeyResult } from "../objects/create-user-api-key-result.object.js";
import { UserApiKeyService } from "../services/user-api-key.service.js";

/** GraphQL mutations for user-owned API keys. */
@Resolver(() => UserApiKey)
export class UserApiKeyResolver {
  /** Creates the user API-key resolver. */
  constructor(
    /** User API-key domain service. */
    readonly apiKeyService: UserApiKeyService,
  ) {}

  /** Creates a credential and returns its plaintext once. */
  @Mutation(() => CreateUserApiKeyResult)
  async createUserApiKey(
    @Args("input") input: CreateUserApiKeyInput,
    @CurrentUser() user: User,
  ): Promise<CreateUserApiKeyResult> {
    return await this.apiKeyService.createUserApiKey(user, input);
  }

  /** Updates a credential owned by the current user. */
  @Mutation(() => UserApiKey)
  async updateUserApiKey(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateUserApiKeyInput,
  ): Promise<UserApiKey> {
    return await this.apiKeyService.updateUserApiKey(id, input);
  }

  /** Deletes a credential owned by the current user. */
  @Mutation(() => UserApiKey)
  async deleteUserApiKey(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<UserApiKey> {
    return await this.apiKeyService.deleteUserApiKey(id);
  }
}
