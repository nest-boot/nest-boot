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

import {
  SystemAccountApiKeyConnection,
  SystemAccountApiKeyConnectionArgs,
} from "../connections/system-account-api-key.connection-definition.js";
import { SystemAccount } from "../entities/system-account.entity.js";
import { SystemAccountApiKey } from "../entities/system-account-api-key.entity.js";
import { CreateSystemAccountApiKeyInput } from "../inputs/create-system-account-api-key.input.js";
import { UpdateSystemAccountApiKeyInput } from "../inputs/update-system-account-api-key.input.js";
import { ApiKey } from "../objects/api-key.object.js";
import { CreateSystemAccountApiKeyResult } from "../objects/create-system-account-api-key-result.object.js";
import { SystemAccountPermissionOption } from "../objects/system-account-permission-option.object.js";
import { SystemAccountApiKeyService } from "../services/system-account-api-key.service.js";

/** Optional system-account credential API. */
@Resolver(() => SystemAccount)
export class SystemAccountApiKeyResolver {
  /**
   * Creates this resolver.
   * @param keys - System credential administration.
   */
  constructor(private readonly keys: SystemAccountApiKeyService) {}

  /**
   * Lists key grant defaults and ceilings for the parent account.
   * @param account - Owning system account.
   * @returns Configured permission choices bounded by account and issuer.
   */
  @ResolveField(() => [SystemAccountPermissionOption])
  apiKeyPermissions(@Parent() account: SystemAccount) {
    return this.keys.getSystemAccountApiKeyPermissions(account.id);
  }

  /**
   * Lists configured key grants for creation or a selected account.
   * @param systemAccountId - Optional account permission ceiling.
   * @param apiKeyId - Optional key whose account bounds the available grants.
   * @returns Permission options bounded by configuration and issuer grants.
   */
  @Query(() => [SystemAccountPermissionOption])
  systemAccountApiKeyPermissions(
    @Args("systemAccountId", { type: () => ID, nullable: true })
    systemAccountId?: string,
    @Args("apiKeyId", { type: () => ID, nullable: true })
    apiKeyId?: string,
  ) {
    return this.keys.getSystemAccountApiKeyPermissions(
      systemAccountId ?? undefined,
      apiKeyId ?? undefined,
    );
  }

  /**
   * Lists system keys across independent accounts.
   * @param args - Cursor pagination, filtering and ordering arguments.
   * @param info - GraphQL selection information.
   * @returns Authorized system credential metadata without hashes.
   */
  @Query(() => SystemAccountApiKeyConnection)
  systemApiKeys(
    @Args({ type: () => SystemAccountApiKeyConnectionArgs })
    args: ConnectionArgsInterface<SystemAccountApiKey>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return this.keys.getSystemAccountApiKeyConnection(undefined, args, info);
  }

  /**
   * Lists credentials owned by the parent system identity.
   * @param account - System account whose credential metadata is requested.
   * @param args - Cursor pagination, ordering and filtering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Page of credential metadata belonging to the parent system account.
   */
  @ResolveField(() => SystemAccountApiKeyConnection)
  apiKeys(
    @Parent() account: SystemAccount,
    @Args({ type: () => SystemAccountApiKeyConnectionArgs })
    args: ConnectionArgsInterface<SystemAccountApiKey>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return this.keys.getSystemAccountApiKeyConnection(account.id, args, info);
  }

  /**
   * Returns credential metadata without its stored hash.
   * @param id - Identifier of the target record.
   * @returns Credential metadata, or null when it is unavailable.
   */
  @Query(() => ApiKey, { nullable: true })
  systemAccountApiKey(@Args("id", { type: () => ID }) id: string) {
    return this.keys.getSystemAccountApiKey(id);
  }

  /**
   * Returns a newly issued plaintext credential once.
   * @param systemAccountId - Identifier of the owning system account.
   * @param input - Requested metadata and permission changes.
   * @returns Created credential with its one-time plaintext key.
   */
  @Mutation(() => CreateSystemAccountApiKeyResult)
  createSystemAccountApiKey(
    @Args("systemAccountId", { type: () => ID }) systemAccountId: string,
    @Args("input") input: CreateSystemAccountApiKeyInput,
  ) {
    return this.keys.createSystemAccountApiKey(systemAccountId, input);
  }

  /**
   * Updates a system credential's grants or metadata.
   * @param id - Identifier of the target record.
   * @param input - Requested metadata and permission changes.
   * @returns Updated credential metadata without its hash.
   */
  @Mutation(() => ApiKey)
  updateSystemAccountApiKey(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateSystemAccountApiKeyInput,
  ) {
    return this.keys.updateSystemAccountApiKey(id, input);
  }

  /**
   * Deletes one system credential.
   * @param id - Identifier of the target record.
   * @returns Metadata of the revoked credential.
   */
  @Mutation(() => ApiKey)
  deleteSystemAccountApiKey(@Args("id", { type: () => ID }) id: string) {
    return this.keys.deleteSystemAccountApiKey(id);
  }
}
