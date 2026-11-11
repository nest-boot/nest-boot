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
import type { ConnectionArgsInterface } from "@nest-boot/graphql-connection";
import type { GraphQLResolveInfo } from "graphql";

import {
  SystemAccountConnection,
  SystemAccountConnectionArgs,
} from "../connections/system-account.connection-definition.js";
import {
  SystemAccountApiKeyConnection,
  SystemAccountApiKeyConnectionArgs,
} from "../connections/system-account-api-key.connection-definition.js";
import { SystemAccount } from "../entities/system-account.entity.js";
import { SystemAccountApiKey } from "../entities/system-account-api-key.entity.js";
import { CreateSystemAccountInput } from "../inputs/create-system-account.input.js";
import { CreateSystemAccountApiKeyInput } from "../inputs/create-system-account-api-key.input.js";
import { UpdateSystemAccountInput } from "../inputs/update-system-account.input.js";
import { UpdateSystemAccountApiKeyInput } from "../inputs/update-system-account-api-key.input.js";
import { CreateSystemAccountApiKeyResult } from "../objects/create-system-account-api-key-result.object.js";
import { SystemAccountPermissionOption } from "../objects/system-account-permission-option.object.js";
import { SystemAccountService } from "../services/system-account.service.js";
import { SystemAccountApiKeyService } from "../services/system-account-api-key.service.js";

/** GraphQL management of system identities; services require a user administrator session. */
@Resolver(() => SystemAccount)
export class SystemAccountResolver {
  constructor(
    private readonly accounts: SystemAccountService,
    private readonly keys: SystemAccountApiKeyService,
  ) {}

  /**
   * Lists platform grants available to the administrator creating an account.
   * @returns Permission choices with the current issuer ceiling.
   */
  @Query(() => [SystemAccountPermissionOption])
  systemAccountPermissions() {
    return this.accounts.getSystemAccountPermissions();
  }

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
   * @returns Permission options bounded by configuration and issuer grants.
   */
  @Query(() => [SystemAccountPermissionOption])
  systemAccountApiKeyPermissions(
    @Args("systemAccountId", { type: () => ID, nullable: true })
    systemAccountId?: string,
  ) {
    return this.keys.getSystemAccountApiKeyPermissions(
      systemAccountId ?? undefined,
    );
  }

  /**
   * Lists system keys across independent accounts.
   * @param args - Cursor pagination, filtering and ordering arguments.
   * @param info - GraphQL selection information.
   * @returns Authorized system credential metadata without hashes.
   */
  @Query(() => SystemAccountApiKeyConnection)
  systemAccountApiKeys(
    @Args({ type: () => SystemAccountApiKeyConnectionArgs })
    args: ConnectionArgsInterface<SystemAccountApiKey>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return this.keys.getSystemAccountApiKeyConnection(undefined, args, info);
  }

  /**
   * Finds one system account.
   * @param id - Identifier of the target record.
   * @returns Authorized system account, or null when it is unavailable.
   */
  @Query(() => SystemAccount, { nullable: true })
  systemAccount(@Args("id", { type: () => ID }) id: string) {
    return this.accounts.getSystemAccount(id);
  }

  /**
   * Paginates all system identities.
   * @param args - Cursor pagination, ordering and filtering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Page of authorized system accounts.
   */
  @Query(() => SystemAccountConnection)
  systemAccounts(
    @Args({ type: () => SystemAccountConnectionArgs })
    args: ConnectionArgsInterface<SystemAccount>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return this.accounts.getSystemAccountConnection(args, info);
  }

  /**
   * Creates a system identity.
   * @param input - Requested metadata and permission changes.
   * @returns Created independent system identity.
   */
  @Mutation(() => SystemAccount)
  createSystemAccount(@Args("input") input: CreateSystemAccountInput) {
    return this.accounts.createSystemAccount(input);
  }

  /**
   * Changes or disables a system identity.
   * @param id - Identifier of the target record.
   * @param input - Requested metadata and permission changes.
   * @returns Persisted system identity after the changes.
   */
  @Mutation(() => SystemAccount)
  updateSystemAccount(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateSystemAccountInput,
  ) {
    return this.accounts.updateSystemAccount(id, input);
  }

  /**
   * Deletes an identity and its credentials.
   * @param id - Identifier of the target record.
   * @returns Metadata of the deleted system identity.
   */
  @Mutation(() => SystemAccount)
  deleteSystemAccount(@Args("id", { type: () => ID }) id: string) {
    return this.accounts.deleteSystemAccount(id);
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
  @Query(() => SystemAccountApiKey, { nullable: true })
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
  @Mutation(() => SystemAccountApiKey)
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
  @Mutation(() => SystemAccountApiKey)
  deleteSystemAccountApiKey(@Args("id", { type: () => ID }) id: string) {
    return this.keys.deleteSystemAccountApiKey(id);
  }
}
