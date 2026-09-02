import type { Subject } from "@casl/ability";

import type { CanSubject } from "../types/can-subject.type.js";

/** Internal route metadata produced by the `Can` decorator. */
export interface CanMetadata<T extends Subject = Subject> {
  /** Permission action that must be allowed. */
  action: string;
  /** Permission subject type or subject resolver factory to check. */
  subject: CanSubject<T>;
  /** Authorization domain in which the permission must be granted. */
  scope: "user" | "workspace";
}
