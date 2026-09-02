import { AbilityBuilder, createMongoAbility } from "@casl/ability";

import type { PermissionAbility } from "./types/permission-ability.type.js";

/** CASL ability builder configured for `PermissionAbility`. */
export class PermissionAbilityBuilder extends AbilityBuilder<PermissionAbility> {
  /** Creates an ability builder backed by CASL Mongo ability. */
  constructor() {
    super(createMongoAbility);
  }
}
