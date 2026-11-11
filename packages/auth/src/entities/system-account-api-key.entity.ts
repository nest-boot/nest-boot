/* eslint-disable @nest-boot/graphql-field-config-from-types -- Dynamic permission enums use stored string arrays. */
import { type Opt, type Ref } from "@mikro-orm/core";
import { Field, ID, ObjectType } from "@nest-boot/graphql";

import { SystemAccountPermission } from "../enums/system-account-permission.enum.js";
import { ApiKeyFields } from "./api-key-fields.js";
import { SystemAccount } from "./system-account.entity.js";

/** GraphQL view of a key owned by an independent platform system account. */
@ObjectType()
export class SystemAccountApiKey extends ApiKeyFields {
  /** Concrete owning identity for this public credential view. */
  declare owner: Ref<SystemAccount>;

  /**
   * Reference to the owning systemAccount.
   * @returns Required owner reference for this credential kind.
   */
  override get systemAccount(): Ref<SystemAccount> {
    return this.owner;
  }

  /** Explicit grants; an empty list grants no operations. */
  @Field(() => [SystemAccountPermission])
  declare permissions: Opt<string[]>;

  /**
   * Identifier of the credential's system identity.
   * @returns Identifier of the system account owning the credential.
   */
  @Field(() => ID)
  override get systemAccountId(): Opt<string> {
    return super.systemAccountId;
  }
}
