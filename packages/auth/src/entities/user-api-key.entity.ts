import { type Opt, type Ref } from "@mikro-orm/core";

import { ApiKeyFields } from "./api-key-fields.js";
import { User } from "./user.entity.js";

/** User-key authorization view of a credential persisted as ApiKeyEntity. */
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
  declare permissions: Opt<string[]>;
}
