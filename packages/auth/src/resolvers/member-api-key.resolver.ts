import { Reference } from "@mikro-orm/core";
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
  ApiKeyConnection,
  ApiKeyConnectionArgs,
} from "../connections/api-key.connection-definition.js";
import { CurrentWorkspace } from "../decorators/current-workspace.decorator.js";
import { Member } from "../entities/member.entity.js";
import { MemberApiKey } from "../entities/member-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { CreateMemberApiKeyInput } from "../inputs/create-member-api-key.input.js";
import { UpdateMemberApiKeyInput } from "../inputs/update-member-api-key.input.js";
import { ApiKey } from "../objects/api-key.object.js";
import { CreateMemberApiKeyResult } from "../objects/create-member-api-key-result.object.js";
import { MemberApiKeyPermissionOption } from "../objects/member-api-key-permission-option.object.js";
import { WorkspaceApiKeyService } from "../services/workspace-api-key.service.js";
import { type ApiKeyMetadata } from "../types/api-key-metadata.type.js";

/** Optional workspace member credential API. */
@Resolver(() => Member)
export class MemberApiKeyResolver {
  /**
   * Creates the member API-key resolver.
   * @param apiKeyService - Service for validating or managing API keys.
   */
  constructor(
    /** Member API-key domain service. */
    readonly apiKeyService: WorkspaceApiKeyService,
  ) {}

  /**
   * Lists permission choices for keys owned by the selected workspace.
   * @param workspace - The workspace that scopes this operation.
   * @returns Permission choices and grant availability for member API keys.
   */
  @Query(() => [MemberApiKeyPermissionOption])
  memberApiKeyPermissions(
    @CurrentWorkspace() workspace: Workspace,
  ): MemberApiKeyPermissionOption[] {
    return this.apiKeyService.getMemberApiKeyPermissions(workspace);
  }

  /**
   * Creates a credential and returns its plaintext once.
   * @param input - Requested field values for the operation.
   * @param workspace - The workspace that scopes this operation.
   * @returns Created key metadata and its one-time plaintext credential.
   */
  @Mutation(() => CreateMemberApiKeyResult)
  async createMemberApiKey(
    @Args("input") input: CreateMemberApiKeyInput,
    @CurrentWorkspace() workspace: Workspace,
  ): Promise<CreateMemberApiKeyResult> {
    const { memberId, ...options } = input;
    return await this.apiKeyService.createMemberApiKey(workspace, {
      ...options,
      ...(memberId ? { member: memberId } : {}),
    });
  }

  /**
   * Updates a credential owned by the current workspace.
   * @param id - Identifier of the record to access.
   * @param input - Requested field values for the operation.
   * @returns Updated API key metadata without the stored credential hash.
   */
  @Mutation(() => ApiKey)
  async updateMemberApiKey(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateMemberApiKeyInput,
  ): Promise<ApiKeyMetadata<MemberApiKey>> {
    return await this.apiKeyService.updateMemberApiKey(id, input);
  }

  /**
   * Deletes a credential owned by the current workspace.
   * @param id - Identifier of the record to access.
   * @returns Deleted API key metadata without the stored credential hash.
   */
  @Mutation(() => ApiKey)
  async deleteMemberApiKey(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ApiKeyMetadata<MemberApiKey>> {
    return await this.apiKeyService.deleteMemberApiKey(id);
  }

  /**
   * Lists credentials belonging to this member within the selected workspace.
   * @param member - Owning workspace identity.
   * @param args - Pagination, filtering and ordering arguments.
   * @param info - GraphQL selection information.
   * @returns Authorized metadata belonging to this member only.
   */
  @ResolveField(() => ApiKeyConnection)
  apiKeys(
    @Parent() member: Member,
    @Args({ type: () => ApiKeyConnectionArgs })
    args: ConnectionArgsInterface<MemberApiKey>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return this.apiKeyService.getMemberApiKeyConnection(
      Reference.unwrapReference(member.workspace),
      args,
      info,
      member,
    );
  }
}
