import { Args, ID, Info, Mutation, Query, Resolver } from "@nest-boot/graphql";
import { type ConnectionArgsInterface } from "@nest-boot/graphql-connection";
import { type GraphQLResolveInfo } from "graphql";

import { SystemAccount } from "../../api-key/entities/system-account.entity.js";
import {
  SystemAccountConnection,
  SystemAccountConnectionArgs,
} from "../connections/system-account.connection-definition.js";
import { CreateSystemAccountInput } from "../inputs/create-system-account.input.js";
import { UpdateSystemAccountInput } from "../inputs/update-system-account.input.js";
import { SystemAccountPermissionOption } from "../objects/system-account-permission-option.object.js";
import { SystemAccountService } from "../services/system-account.service.js";

/** Optional independent system-account administration. */
@Resolver(() => SystemAccount)
export class SystemAccountResolver {
  /**
   * Creates this resolver.
   * @param accounts - System identity administration.
   */
  constructor(private readonly accounts: SystemAccountService) {}

  /**
   * Lists platform grants available to the administrator creating an account.
   * @returns Permission choices with the current issuer ceiling.
   */
  @Query(() => [SystemAccountPermissionOption])
  systemAccountPermissions() {
    return this.accounts.getSystemAccountPermissions();
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
}
