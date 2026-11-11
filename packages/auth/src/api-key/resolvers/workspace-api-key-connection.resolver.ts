import {
  Args,
  ID,
  Info,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nest-boot/graphql";
import { type ConnectionArgsInterface } from "@nest-boot/graphql-connection";
import { type GraphQLResolveInfo } from "graphql";

import { CurrentWorkspace } from "../../workspace/decorators/current-workspace.decorator.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import {
  WorkspaceApiKeyConnection,
  WorkspaceApiKeyConnectionArgs,
} from "../connections/workspace-api-key.connection-definition.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { WorkspaceApiKeyService } from "../services/workspace-api-key.service.js";
import { type ApiKeyMetadata } from "../types/api-key-metadata.type.js";

/** Optional selected-workspace credential aggregation. */
@Resolver(() => Workspace)
export class WorkspaceApiKeyConnectionResolver {
  /**
   * Creates this resolver.
   * @param apiKeyService - Workspace credential operations.
   */
  constructor(readonly apiKeyService: WorkspaceApiKeyService) {}

  /**
   * Returns an accessible API key owned by the parent workspace.
   * @param workspace - The workspace that scopes this operation.
   * @param id - Identifier of the record to access.
   * @returns Accessible API key metadata, or null if unavailable.
   */
  @ResolveField(() => WorkspaceApiKey, { nullable: true })
  async apiKey(
    @Parent() workspace: Workspace,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ApiKeyMetadata<WorkspaceApiKey> | null> {
    return await this.apiKeyService.getWorkspaceApiKey(id, workspace);
  }

  /**
   * Paginates credentials across members of the selected workspace.
   * @param workspace - The workspace that scopes this operation.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated API key metadata with credential hashes omitted.
   */
  @Query(() => WorkspaceApiKeyConnection)
  async workspaceApiKeys(
    @CurrentWorkspace() workspace: Workspace,
    @Args({ type: () => WorkspaceApiKeyConnectionArgs })
    args: ConnectionArgsInterface<WorkspaceApiKey>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return await this.apiKeyService.getWorkspaceApiKeyConnection(
      workspace,
      args,
      info,
    );
  }
}
