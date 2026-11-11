import { Parent, ResolveField, Resolver } from "@nest-boot/graphql";

import { SystemAccountService } from "../../admin/services/system-account.service.js";
import { SystemAccount } from "../entities/system-account.entity.js";
import { SystemApiKey } from "../entities/system-api-key.entity.js";
import { resolveApiKeyRelation } from "../utils/resolve-api-key-relation.util.js";

/** Authorized systemAccount details for system credentials. */
@Resolver(() => SystemApiKey)
export class SystemApiKeyRelationResolver {
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
