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

import { CurrentWorkspace } from "../../workspace/decorators/current-workspace.decorator.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import {
  WorkspaceApiKeyConnection,
  WorkspaceApiKeyConnectionArgs,
} from "../connections/workspace-api-key.connection-definition.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { CreateWorkspaceApiKeyInput } from "../inputs/create-workspace-api-key.input.js";
import { UpdateWorkspaceApiKeyInput } from "../inputs/update-workspace-api-key.input.js";
import { CreateWorkspaceApiKeyResult } from "../objects/create-workspace-api-key-result.object.js";
import { WorkspaceApiKey } from "../objects/workspace-api-key.object.js";
import { WorkspaceApiKeyPermissionOption } from "../objects/workspace-api-key-permission-option.object.js";
import { WorkspaceApiKeyService } from "../services/workspace-api-key.service.js";
import { type ApiKeyMetadata } from "../types/api-key-metadata.type.js";

/** Optional workspace member credential API. */
@Resolver(() => WorkspaceMember)
export class WorkspaceApiKeyResolver {
  /**
   * Creates the member API-key resolver.
   * @param apiKeyService - Service for validating or managing API keys.
   */
  constructor(
    /** WorkspaceMember API-key domain service. */
    readonly apiKeyService: WorkspaceApiKeyService,
  ) {}

  /**
   * Lists permission choices for keys owned by the selected workspace.
   * @param workspace - The workspace that scopes this operation.
   * @returns Permission choices and grant availability for member API keys.
   */
  @Query(() => [WorkspaceApiKeyPermissionOption])
  workspaceApiKeyPermissions(
    @CurrentWorkspace() workspace: Workspace,
  ): WorkspaceApiKeyPermissionOption[] {
    return this.apiKeyService.getWorkspaceApiKeyPermissions(workspace);
  }

  /**
   * Creates a credential and returns its plaintext once.
   * @param input - Requested field values for the operation.
   * @param workspace - The workspace that scopes this operation.
   * @returns Created key metadata and its one-time plaintext credential.
   */
  @Mutation(() => CreateWorkspaceApiKeyResult)
  async createWorkspaceApiKey(
    @Args("input") input: CreateWorkspaceApiKeyInput,
    @CurrentWorkspace() workspace: Workspace,
  ): Promise<CreateWorkspaceApiKeyResult> {
    const { memberId, ...options } = input;
    return await this.apiKeyService.createWorkspaceApiKey(workspace, {
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
  @Mutation(() => WorkspaceApiKey)
  async updateWorkspaceApiKey(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateWorkspaceApiKeyInput,
  ): Promise<ApiKeyMetadata<WorkspaceApiKey>> {
    return await this.apiKeyService.updateWorkspaceApiKey(id, input);
  }

  /**
   * Deletes a credential owned by the current workspace.
   * @param id - Identifier of the record to access.
   * @returns Deleted API key metadata without the stored credential hash.
   */
  @Mutation(() => WorkspaceApiKey)
  async deleteWorkspaceApiKey(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ApiKeyMetadata<WorkspaceApiKey>> {
    return await this.apiKeyService.deleteWorkspaceApiKey(id);
  }

  /**
   * Lists credentials belonging to this member within the selected workspace.
   * @param member - Owning workspace identity.
   * @param args - Pagination, filtering and ordering arguments.
   * @param info - GraphQL selection information.
   * @returns Authorized metadata belonging to this member only.
   */
  @ResolveField(() => WorkspaceApiKeyConnection)
  apiKeys(
    @Parent() member: WorkspaceMember,
    @Args({ type: () => WorkspaceApiKeyConnectionArgs })
    args: ConnectionArgsInterface<ApiKey>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return this.apiKeyService.getWorkspaceApiKeyConnection(
      Reference.unwrapReference(member.workspace),
      args,
      info,
      member,
    );
  }
}
