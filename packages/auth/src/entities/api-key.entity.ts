import { type Ref } from "@mikro-orm/core";
import {
  Check,
  Entity,
  ManyToOne,
  Trigger,
} from "@mikro-orm/decorators/legacy";

import { apiKeyOwnerTrigger } from "../infrastructure/api-key-triggers.js";
import { apiKeyOwnerPolicy } from "../policies/api-key-owner.policy.js";
import { ApiKeyFields } from "./api-key-fields.js";
import { Member } from "./member.entity.js";
import { SystemAccount } from "./system-account.entity.js";
import { User } from "./user.entity.js";

/** Single persistent API-key entity with a polymorphic owner. */
@Entity({ tableName: "api_key", policies: [apiKeyOwnerPolicy(true)] })
@Check({
  name: "api_key_owner_type_check",
  expression: `"owner_type" in ('user', 'member', 'system_account')`,
})
@Trigger(apiKeyOwnerTrigger(true, "public"))
export class ApiKeyEntity extends ApiKeyFields {
  /** Required polymorphic identity; feature registration filters optional targets per ORM. */
  @ManyToOne(() => [User, Member, SystemAccount], {
    ref: true,
    discriminator: "owner",
  })
  declare owner: Ref<User | Member | SystemAccount>;
}
