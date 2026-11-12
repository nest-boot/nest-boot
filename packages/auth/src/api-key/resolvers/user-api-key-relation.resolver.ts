import { Parent, ResolveField, Resolver } from "@nest-boot/graphql";

import { filterPermissionValues } from "../../common/utils/filter-permission-values.util.js";
import { User } from "../../core/entities/user.entity.js";
import { UserService } from "../../core/services/user.service.js";
import { UserApiKeyPermission } from "../enums/user-api-key-permission.enum.js";
import { UserApiKey } from "../objects/user-api-key.object.js";
import { resolveApiKeyRelation } from "../utils/resolve-api-key-relation.util.js";

/** Authorized user details for user credentials. */
@Resolver(() => UserApiKey)
export class UserApiKeyRelationResolver {
  /**
   * Resolves grants supported by the current GraphQL permission catalog.
   * @param key - Identity or credential whose stored grants are being presented.
   * @returns Serializable permission values without mutating effective grants.
   */
  @ResolveField(() => [UserApiKeyPermission])
  permissions(@Parent() key: UserApiKey): UserApiKeyPermission[] {
    return filterPermissionValues(key.permissions, UserApiKeyPermission);
  }

  constructor(private readonly identities: UserService) {}
  @ResolveField(() => User, { nullable: true })
  async user(@Parent() key: UserApiKey): Promise<User | null> {
    return await resolveApiKeyRelation(key, key.user, User, (id) =>
      this.identities.getUser(id),
    );
  }
}
