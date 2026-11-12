import { Parent, ResolveField, Resolver } from "@nest-boot/graphql";

import { Member } from "../../workspace/entities/member.entity.js";
import { MemberService } from "../../workspace/services/member.service.js";
import { WorkspaceApiKey } from "../objects/workspace-api-key.object.js";
import { resolveApiKeyRelation } from "../utils/resolve-api-key-relation.util.js";

/** Authorized member details for workspace credentials. */
@Resolver(() => WorkspaceApiKey)
export class WorkspaceApiKeyRelationResolver {
  constructor(private readonly identities: MemberService) {}
  @ResolveField(() => Member, { nullable: true })
  async member(@Parent() key: WorkspaceApiKey): Promise<Member | null> {
    return await resolveApiKeyRelation(key, key.member, Member, (id) =>
      this.identities.getMember(id),
    );
  }
}
