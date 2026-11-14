import { BaseEntity, type Ref } from "@mikro-orm/core";

import type { User } from "../../core/entities/user.entity.js";
import type { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import type { SystemAccount } from "./system-account.entity.js";

/** Abstract persistence base for the feature-specific polymorphic owner mapping. */
export abstract class BaseApiKey extends BaseEntity {
  /** User, workspace member or independent system account that owns the credential. */
  owner!: Ref<User | WorkspaceMember | SystemAccount>;
}
