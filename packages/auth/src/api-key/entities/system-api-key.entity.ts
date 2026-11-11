/* eslint-disable @nest-boot/graphql-field-config-from-types -- Runtime permission catalogs require explicit enum metadata. */
import { type Opt, type Ref } from "@mikro-orm/core";
import { Field, HideField, ObjectType } from "@nest-boot/graphql";

import { SystemApiKeyPermission } from "../enums/system-api-key-permission.enum.js";
import { ApiKeyFields } from "./api-key-fields.js";
import { SystemAccount } from "./system-account.entity.js";

/** authorization view of a key owned by an independent platform system account. */
@ObjectType({ isAbstract: true })
export class SystemApiKey extends ApiKeyFields {
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
  declare permissions: Opt<string[]>;

  /**
   * Identifier of the credential's system identity for internal authorization.
   * @returns Identifier of the system account owning the credential.
   */
  override get systemAccountId(): Opt<string> {
    return super.systemAccountId;
  }
}
