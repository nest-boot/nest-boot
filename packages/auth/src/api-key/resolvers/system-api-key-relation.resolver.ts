import { Parent, ResolveField, Resolver } from "@nest-boot/graphql";

import { SystemAccountService } from "../../admin/services/system-account.service.js";
import { filterPermissionValues } from "../../common/utils/filter-permission-values.util.js";
import { SystemAccount } from "../entities/system-account.entity.js";
import { SystemApiKeyPermission } from "../enums/system-api-key-permission.enum.js";
import { SystemApiKey } from "../objects/system-api-key.object.js";
import { resolveApiKeyRelation } from "../utils/resolve-api-key-relation.util.js";

/** Authorized systemAccount details for system credentials. */
@Resolver(() => SystemApiKey)
export class SystemApiKeyRelationResolver {
  /**
   * Resolves grants supported by the current GraphQL permission catalog.
   * @param key - Identity or credential whose stored grants are being presented.
   * @returns Serializable permission values without mutating effective grants.
   */
  @ResolveField(() => [SystemApiKeyPermission])
  permissions(@Parent() key: SystemApiKey): SystemApiKeyPermission[] {
    return filterPermissionValues(key.permissions, SystemApiKeyPermission);
  }

  constructor(private readonly identities: SystemAccountService) {}
  @ResolveField(() => SystemAccount, { nullable: true })
  async systemAccount(
    @Parent() key: SystemApiKey,
  ): Promise<SystemAccount | null> {
    return await resolveApiKeyRelation(
      key,
      key.systemAccount,
      SystemAccount,
      (id) => this.identities.getSystemAccount(id),
      false,
    );
  }
}
