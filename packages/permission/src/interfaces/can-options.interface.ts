import type { Subject } from "@casl/ability";

import type { PermissionAction } from "../enums/permission-action.enum";
import type { CanSubject } from "../types/can-subject.type";

/** Full `Can` decorator options. */
export interface CanOptions<T extends Subject = Subject> {
  /** Permission action that must be allowed. */
  action: PermissionAction;
  /** Permission subject type or subject resolver factory to check. */
  subject: CanSubject<T>;
}
