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
  SystemApiKeyConnection,
  SystemApiKeyConnectionArgs,
} from "../connections/system-api-key.connection-definition.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { SystemAccount } from "../entities/system-account.entity.js";
import { CreateSystemApiKeyInput } from "../inputs/create-system-api-key.input.js";
import { UpdateSystemApiKeyInput } from "../inputs/update-system-api-key.input.js";
import { CreateSystemApiKeyResult } from "../objects/create-system-api-key-result.object.js";
import { SystemApiKey } from "../objects/system-api-key.object.js";
import { SystemApiKeyPermissionOption } from "../objects/system-api-key-permission-option.object.js";
import { SystemApiKeyService } from "../services/system-api-key.service.js";

/** Optional system-account credential API. */
@Resolver(() => SystemAccount)
export class SystemApiKeyResolver {
  /**
   * Creates this resolver.
   * @param keys - System credential administration.
   */
  constructor(private readonly keys: SystemApiKeyService) {}

  /**
   * Lists key grant defaults and ceilings for the parent account.
   * @param account - Owning system account.
   * @returns Configured permission choices bounded by account and issuer.
   */
  @ResolveField(() => [SystemApiKeyPermissionOption])
  apiKeyPermissions(@Parent() account: SystemAccount) {
    return this.keys.getSystemApiKeyPermissions(account.id);
  }

  /**
   * Lists configured key grants for creation or a selected account.
   * @param systemAccountId - Optional account permission ceiling.
   * @param apiKeyId - Optional key whose account bounds the available grants.
   * @returns Permission options bounded by configuration and issuer grants.
   */
  @Query(() => [SystemApiKeyPermissionOption])
  systemApiKeyPermissions(
    @Args("systemAccountId", { type: () => ID, nullable: true })
    systemAccountId?: string,
    @Args("apiKeyId", { type: () => ID, nullable: true })
    apiKeyId?: string,
  ) {
    return this.keys.getSystemApiKeyPermissions(
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
  @Query(() => SystemApiKeyConnection)
  systemApiKeys(
    @Args({ type: () => SystemApiKeyConnectionArgs })
    args: ConnectionArgsInterface<ApiKey>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return this.keys.getSystemApiKeyConnection(undefined, args, info);
  }

  /**
   * Lists credentials owned by the parent system identity.
   * @param account - System account whose credential metadata is requested.
   * @param args - Cursor pagination, ordering and filtering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Page of credential metadata belonging to the parent system account.
   */
  @ResolveField(() => SystemApiKeyConnection)
  apiKeys(
    @Parent() account: SystemAccount,
    @Args({ type: () => SystemApiKeyConnectionArgs })
    args: ConnectionArgsInterface<ApiKey>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return this.keys.getSystemApiKeyConnection(account.id, args, info);
  }

  /**
   * Returns credential metadata without its stored hash.
   * @param id - Identifier of the target record.
   * @returns Credential metadata, or null when it is unavailable.
   */
  @Query(() => SystemApiKey, { nullable: true })
  systemApiKey(@Args("id", { type: () => ID }) id: string) {
    return this.keys.getSystemApiKey(id);
  }

  /**
   * Returns a newly issued plaintext credential once.
   * @param systemAccountId - Identifier of the owning system account.
   * @param input - Requested metadata and permission changes.
   * @returns Created credential with its one-time plaintext key.
   */
  @Mutation(() => CreateSystemApiKeyResult)
  createSystemApiKey(
    @Args("systemAccountId", { type: () => ID }) systemAccountId: string,
    @Args("input") input: CreateSystemApiKeyInput,
  ) {
    return this.keys.createSystemApiKey(systemAccountId, input);
  }

  /**
   * Updates a system credential's grants or metadata.
   * @param id - Identifier of the target record.
   * @param input - Requested metadata and permission changes.
   * @returns Updated credential metadata without its hash.
   */
  @Mutation(() => SystemApiKey)
  updateSystemApiKey(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateSystemApiKeyInput,
  ) {
    return this.keys.updateSystemApiKey(id, input);
  }

  /**
   * Deletes one system credential.
   * @param id - Identifier of the target record.
   * @returns Metadata of the revoked credential.
   */
  @Mutation(() => SystemApiKey)
  deleteSystemApiKey(@Args("id", { type: () => ID }) id: string) {
    return this.keys.deleteSystemApiKey(id);
  }
}
