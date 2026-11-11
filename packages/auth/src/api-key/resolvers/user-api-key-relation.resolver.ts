import { Parent, ResolveField, Resolver } from "@nest-boot/graphql";

import { User } from "../../core/entities/user.entity.js";
import { UserService } from "../../core/services/user.service.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { resolveApiKeyRelation } from "../utils/resolve-api-key-relation.util.js";

/** Authorized user details for user credentials. */
@Resolver(() => UserApiKey)
export class UserApiKeyRelationResolver {
  constructor(private readonly identities: UserService) {}
  @ResolveField(() => User, { nullable: true })
  async user(@Parent() key: UserApiKey): Promise<User | null> {
    return await resolveApiKeyRelation(key, key.user, User, (id) =>
      this.identities.getUser(id),
    );
  }
}
