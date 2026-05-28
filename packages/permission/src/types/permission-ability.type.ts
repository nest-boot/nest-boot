import type { MongoAbility, Subject } from "@casl/ability";

import type { PermissionAction } from "../enums/permission-action.enum";

/** CASL ability type used by the permission module. */
export type PermissionAbility = MongoAbility<[PermissionAction, Subject]>;
