/* eslint-disable @nest-boot/graphql-field-config-from-types -- Runtime permission catalogs require explicit enum metadata. */
import { type Opt, type Ref } from "@mikro-orm/core";
import { Field, HideField, ObjectType } from "@nest-boot/graphql";

import { User } from "../../core/entities/user.entity.js";
import { UserApiKeyPermission } from "../enums/user-api-key-permission.enum.js";
import { ApiKeyFields } from "./api-key-fields.js";

/** User-key authorization view of a credential persisted as ApiKey. */
@ObjectType({ isAbstract: true })
export class UserApiKey extends ApiKeyFields {
  /**
   * Owner kind represented by this API view.
   * @returns Concrete kind of the polymorphic credential owner.
   */
  override get ownerType(): Opt<"user" | "member" | "system_account"> {
    return "user";
  }

  /** Concrete owning identity for this public credential view. */
  @HideField()
  declare owner: Ref<User>;

  /**
   * Reference to the owning user.
   * @returns Required owner reference for this credential kind.
   */
  override get user(): Ref<User> {
    return this.owner;
  }
  override set user(owner: Ref<User> | User | undefined) {
    super.user = owner;
  }

  /** Operations allowed by this credential. */
  @Field(() => [UserApiKeyPermission])
  declare permissions: Opt<string[]>;
}
