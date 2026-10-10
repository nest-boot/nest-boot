import { Args, ID, Mutation, Query, Resolver } from "@nest-boot/graphql";

import { CurrentWorkspace } from "../decorators/current-workspace.decorator.js";
import { MemberApiKey } from "../entities/member-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { CreateMemberApiKeyInput } from "../inputs/create-member-api-key.input.js";
import { UpdateMemberApiKeyInput } from "../inputs/update-member-api-key.input.js";
import { CreateMemberApiKeyResult } from "../objects/create-member-api-key-result.object.js";
import { MemberApiKeyPermissionOption } from "../objects/member-api-key-permission-option.object.js";
import { MemberApiKeyService } from "../services/member-api-key.service.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";

/** GraphQL mutations for member-owned, workspace-scoped API keys. */
@Resolver(() => MemberApiKey)
export class MemberApiKeyResolver {
  /**
   * Creates the member API-key resolver.
   * @param apiKeyService - Service for validating or managing API keys.
   */
  constructor(
    /** Member API-key domain service. */
    readonly apiKeyService: MemberApiKeyService,
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
  @Mutation(() => MemberApiKey)
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
  @Mutation(() => MemberApiKey)
  async deleteMemberApiKey(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ApiKeyMetadata<MemberApiKey>> {
    return await this.apiKeyService.deleteMemberApiKey(id);
  }
}
