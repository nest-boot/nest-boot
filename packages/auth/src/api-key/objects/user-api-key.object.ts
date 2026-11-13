/* eslint-disable @nest-boot/graphql-field-config-from-types -- Permission enums are populated from runtime catalogs. */
import { type Ref } from "@mikro-orm/core";
import { Field, HideField, ObjectType } from "@nest-boot/graphql";

import { User } from "../../core/entities/user.entity.js";
import { UserApiKeyPermission } from "../enums/user-api-key-permission.enum.js";
import { ApiKeyObject } from "./api-key.object.js";

/** User-key authorization view of a credential persisted as ApiKey. */
@ObjectType({ isAbstract: true })
export class UserApiKey extends ApiKeyObject {
  /**
   * Owner kind represented by this API view.
   * @returns Concrete kind of the polymorphic credential owner.
   */
  override get ownerType(): "user" {
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
  declare permissions: string[];
}
