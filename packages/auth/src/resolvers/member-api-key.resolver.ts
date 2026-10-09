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
  /** Creates the member API-key resolver. */
  constructor(
    /** Member API-key domain service. */
    readonly apiKeyService: MemberApiKeyService,
  ) {}

  /** Lists permission choices for keys owned by the selected workspace. */
  @Query(() => [MemberApiKeyPermissionOption])
  memberApiKeyPermissions(
    @CurrentWorkspace() workspace: Workspace,
  ): MemberApiKeyPermissionOption[] {
    return this.apiKeyService.getMemberApiKeyPermissions(workspace);
  }

  /** Creates a credential and returns its plaintext once. */
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

  /** Updates a credential owned by the current workspace. */
  @Mutation(() => MemberApiKey)
  async updateMemberApiKey(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateMemberApiKeyInput,
  ): Promise<ApiKeyMetadata<MemberApiKey>> {
    return await this.apiKeyService.updateMemberApiKey(id, input);
  }

  /** Deletes a credential owned by the current workspace. */
  @Mutation(() => MemberApiKey)
  async deleteMemberApiKey(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ApiKeyMetadata<MemberApiKey>> {
    return await this.apiKeyService.deleteMemberApiKey(id);
  }
}
