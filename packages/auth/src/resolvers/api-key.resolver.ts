import { Parent, ResolveField, Resolver } from "@nest-boot/graphql";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException, Inject, Optional } from "@nestjs/common";

import { Member } from "../entities/member.entity.js";
import { SystemAccount } from "../entities/system-account.entity.js";
import { User } from "../entities/user.entity.js";
import { ApiKey } from "../objects/api-key.object.js";
import { ApiKeyOwner } from "../objects/api-key-owner.union.js";
import { MemberService } from "../services/member.service.js";
import { SystemAccountService } from "../services/system-account.service.js";
import { UserService } from "../services/user.service.js";
import { authorize } from "../utils/authorize.util.js";
import { can } from "../utils/can.util.js";

/** Owner details have the same authorization boundary as direct identity queries. */
@Resolver(() => ApiKey)
export class ApiKeyResolver {
  constructor(
    private readonly users: UserService,
    @Optional() @Inject(MemberService) private readonly members?: MemberService,
    @Optional()
    @Inject(SystemAccountService)
    private readonly systems?: SystemAccountService,
  ) {}

  /**
   * Credential access never implicitly grants access to the owning identity.
   * @param key - Credential metadata from an owner-scoped management service.
   * @returns Readable owner, or null if unavailable or unauthorized.
   */
  @ResolveField(() => ApiKeyOwner, { nullable: true })
  async owner(
    @Parent() key: ApiKey,
  ): Promise<User | Member | SystemAccount | null> {
    try {
      authorize("read", key);
      if (key.ownerType === "user") {
        const current = RequestContext.isActive()
          ? RequestContext.get(User)
          : undefined;
        if (current?.id === key.owner.id) {
          return current;
        }
        return can("read", User)
          ? await this.users.getUser(key.owner.id)
          : null;
      }
      if (key.ownerType === "member") {
        const current = RequestContext.isActive()
          ? RequestContext.get(Member)
          : undefined;
        if (current?.id === key.owner.id) {
          return current;
        }
        return this.members && can("read", Member)
          ? await this.members.getMember(key.owner.id)
          : null;
      }
      return this.systems && can("read", SystemAccount)
        ? await this.systems.getSystemAccount(key.owner.id)
        : null;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return null;
      }
      throw error;
    }
  }
}
