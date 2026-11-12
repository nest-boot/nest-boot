/* eslint-disable @nest-boot/graphql-field-config-from-types -- Permission enums are populated from runtime catalogs. */
import { type Ref } from "@mikro-orm/core";
import { Field, HideField, ObjectType } from "@nest-boot/graphql";

import { SystemAccount } from "../entities/system-account.entity.js";
import { SystemApiKeyPermission } from "../enums/system-api-key-permission.enum.js";
import { ApiKeyObject } from "./api-key.object.js";

/** authorization view of a key owned by an independent platform system account. */
@ObjectType({ isAbstract: true })
export class SystemApiKey extends ApiKeyObject {
  /**
   * Credential kind represented by this DTO.
   * @returns Value for the credential identity or authorization condition.
   */
  override get ownerType(): "system_account" {
    return "system_account";
  }
  /** Concrete owning identity for this public credential view. */
  @HideField()
  declare owner: Ref<SystemAccount>;

  /**
   * Reference to the owning systemAccount.
   * @returns Required owner reference for this credential kind.
   */
  override get systemAccount(): Ref<SystemAccount> {
    return this.owner;
  }

  /** Explicit grants; an empty list grants no operations. */
  @Field(() => [SystemApiKeyPermission])
  declare permissions: string[];
}
