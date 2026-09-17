import { Args, ID, Mutation, Resolver } from "@nest-boot/graphql";

import { CurrentWorkspace } from "../decorators/current-workspace.decorator.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { CreateWorkspaceApiKeyInput } from "../inputs/create-workspace-api-key.input.js";
import { UpdateWorkspaceApiKeyInput } from "../inputs/update-workspace-api-key.input.js";
import { CreateWorkspaceApiKeyResult } from "../objects/create-workspace-api-key-result.object.js";
import { WorkspaceApiKeyService } from "../services/workspace-api-key.service.js";

/** GraphQL mutations for workspace-owned API keys. */
@Resolver(() => WorkspaceApiKey)
export class WorkspaceApiKeyResolver {
  /** Creates the workspace API-key resolver. */
  constructor(
    /** Workspace API-key domain service. */
    readonly apiKeyService: WorkspaceApiKeyService,
  ) {}

  /** Creates a credential and returns its plaintext once. */
  @Mutation(() => CreateWorkspaceApiKeyResult)
  async createWorkspaceApiKey(
    @Args("input") input: CreateWorkspaceApiKeyInput,
    @CurrentWorkspace() workspace: Workspace,
  ): Promise<CreateWorkspaceApiKeyResult> {
    return await this.apiKeyService.createWorkspaceApiKey(workspace, input);
  }

  /** Updates a credential owned by the current workspace. */
  @Mutation(() => WorkspaceApiKey)
  async updateWorkspaceApiKey(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateWorkspaceApiKeyInput,
  ): Promise<WorkspaceApiKey> {
    return await this.apiKeyService.updateWorkspaceApiKey(id, input);
  }

  /** Deletes a credential owned by the current workspace. */
  @Mutation(() => WorkspaceApiKey)
  async deleteWorkspaceApiKey(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<WorkspaceApiKey> {
    return await this.apiKeyService.deleteWorkspaceApiKey(id);
  }
}
