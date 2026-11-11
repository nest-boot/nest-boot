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

import {
  MemberApiKeyConnection,
  MemberApiKeyConnectionArgs,
} from "../connections/member-api-key.connection-definition.js";
import { CurrentWorkspace } from "../decorators/current-workspace.decorator.js";
import { MemberApiKey } from "../entities/member-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { ApiKey } from "../objects/api-key.object.js";
import { MemberApiKeyService } from "../services/member-api-key.service.js";
import { type ApiKeyMetadata } from "../types/api-key-metadata.type.js";

/** Optional selected-workspace credential aggregation. */
@Resolver(() => Workspace)
export class WorkspaceApiKeyResolver {
  /**
   * Creates this resolver.
   * @param apiKeyService - Workspace credential operations.
   */
  constructor(readonly apiKeyService: MemberApiKeyService) {}

  /**
   * Returns an accessible API key owned by the parent workspace.
   * @param workspace - The workspace that scopes this operation.
   * @param id - Identifier of the record to access.
   * @returns Accessible API key metadata, or null if unavailable.
   */
  @ResolveField(() => ApiKey, { nullable: true })
  async apiKey(
    @Parent() workspace: Workspace,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ApiKeyMetadata<MemberApiKey> | null> {
    return await this.apiKeyService.getMemberApiKey(id, workspace);
  }

  /**
   * Paginates credentials across members of the selected workspace.
   * @param workspace - The workspace that scopes this operation.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated API key metadata with credential hashes omitted.
   */
  @Query(() => MemberApiKeyConnection)
  async workspaceApiKeys(
    @CurrentWorkspace() workspace: Workspace,
    @Args({ type: () => MemberApiKeyConnectionArgs })
    args: ConnectionArgsInterface<MemberApiKey>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return await this.apiKeyService.getMemberApiKeyConnection(
      workspace,
      args,
      info,
    );
  }
}
