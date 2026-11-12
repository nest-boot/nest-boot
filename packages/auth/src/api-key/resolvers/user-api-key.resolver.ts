import {
  Args,
  ID,
  Info,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nest-boot/graphql";
import { type ConnectionArgsInterface } from "@nest-boot/graphql-connection";
import { type GraphQLResolveInfo } from "graphql";

import { CurrentUser } from "../../core/decorators/current-user.decorator.js";
import { User } from "../../core/entities/user.entity.js";
import {
  UserApiKeyConnection,
  UserApiKeyConnectionArgs,
} from "../connections/user-api-key.connection-definition.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { CreateUserApiKeyInput } from "../inputs/create-user-api-key.input.js";
import { UpdateUserApiKeyInput } from "../inputs/update-user-api-key.input.js";
import { CreateUserApiKeyResult } from "../objects/create-user-api-key-result.object.js";
import { UserApiKey } from "../objects/user-api-key.object.js";
import { UserApiKeyPermissionOption } from "../objects/user-api-key-permission-option.object.js";
import { UserApiKeyService } from "../services/user-api-key.service.js";
import { type ApiKeyMetadata } from "../types/api-key-metadata.type.js";

/** Optional personal credential API. */
@Resolver(() => User)
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
   * Permanently revokes a key while retaining its audit record.
   * @param id - Identifier of the credential.
   * @returns Retained credential metadata.
   */
  @Mutation(() => UserApiKey)
  revokeUserApiKey(@Args("id", { type: () => ID }) id: string) {
    return this.apiKeyService.revokeUserApiKey(id);
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

  /**
   * Returns an accessible API key owned by the parent user.
   * @param user - The user whose account is being accessed.
   * @param id - Identifier of the record to access.
   * @returns Accessible API key metadata, or null if unavailable.
   */
  @ResolveField(() => UserApiKey, { nullable: true })
  async apiKey(
    @Parent() user: User,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ApiKeyMetadata<UserApiKey> | null> {
    return await this.apiKeyService.getUserApiKey(id, user);
  }

  /**
   * Paginates API keys owned by the parent user.
   * @param user - The user whose account is being accessed.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated API key metadata with credential hashes omitted.
   */
  @ResolveField(() => UserApiKeyConnection)
  async apiKeys(
    @Parent() user: User,
    @Args({ type: () => UserApiKeyConnectionArgs })
    args: ConnectionArgsInterface<ApiKey>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return await this.apiKeyService.getUserApiKeyConnection(user, args, info);
  }
}
