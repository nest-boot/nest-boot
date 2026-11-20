import type { AbilityBuilder } from "@casl/ability";

import type { AuthAbility } from "../auth.ability.js";

/** Native CASL builder used to configure the unified request ability. */
export type AbilityRules = AbilityBuilder<AuthAbility>;
