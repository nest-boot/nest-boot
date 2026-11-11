import { type Ref } from "@mikro-orm/core";
import { Check, Entity, ManyToOne } from "@mikro-orm/decorators/legacy";

import { User } from "../../core/entities/user.entity.js";
import { Member } from "../../workspace/entities/member.entity.js";
import { apiKeyOwnerPolicy } from "../policies/api-key-owner.policy.js";
import { ApiKeyFields } from "./api-key-fields.js";
import { SystemAccount } from "./system-account.entity.js";

/** Single persistent API-key entity with a polymorphic owner. */
@Entity({ policies: [apiKeyOwnerPolicy(true)] })
@Check({
  name: "api_key_owner_type_check",
  expression: `"owner_type" in ('user', 'member', 'system_account')`,
})
export class ApiKey extends ApiKeyFields {
  /** Required polymorphic identity; feature registration filters optional targets per ORM. */
  @ManyToOne(() => [User, Member, SystemAccount], {
    ref: true,
    discriminator: "owner",
  })
  declare owner: Ref<User | Member | SystemAccount>;
}
