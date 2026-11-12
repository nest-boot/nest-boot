import { Parent, ResolveField, Resolver } from "@nest-boot/graphql";

import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { WorkspaceMemberService } from "../../workspace/services/workspace-member.service.js";
import { WorkspaceApiKey } from "../objects/workspace-api-key.object.js";
import { resolveApiKeyRelation } from "../utils/resolve-api-key-relation.util.js";

/** Authorized member details for workspace credentials. */
@Resolver(() => WorkspaceApiKey)
export class WorkspaceApiKeyRelationResolver {
  constructor(private readonly identities: WorkspaceMemberService) {}
  @ResolveField(() => WorkspaceMember, { nullable: true })
  async member(
    @Parent() key: WorkspaceApiKey,
  ): Promise<WorkspaceMember | null> {
    return await resolveApiKeyRelation(key, key.member, WorkspaceMember, (id) =>
      this.identities.getWorkspaceMember(id),
    );
  }
}
