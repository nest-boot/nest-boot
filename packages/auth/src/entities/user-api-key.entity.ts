/* eslint-disable @nest-boot/graphql-field-config-from-types -- Dynamic permission enums use stored string arrays. */
import { type Opt, type Ref } from "@mikro-orm/core";
import { Field, ObjectType } from "@nest-boot/graphql";

import { UserApiKeyPermission } from "../enums/user-api-key-permission.enum.js";
import { ApiKeyFields } from "./api-key-fields.js";
import { User } from "./user.entity.js";

/** User-key GraphQL view of a credential persisted as ApiKeyEntity. */
@ObjectType()
export class UserApiKey extends ApiKeyFields {
  /**
   * Owner kind represented by this API view.
   * @returns Concrete kind of the polymorphic credential owner.
   */
  override get ownerType(): Opt<"user" | "member" | "system_account"> {
    return "user";
  }

  /** Concrete owning identity for this public credential view. */
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
