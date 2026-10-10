import type { Subject } from "@casl/ability";

import type { CanSubjectCallback } from "../types/can-subject-callback.type.js";

/** Route metadata produced by the unified Can decorator. */
export interface CanMetadata<T extends Subject = Subject> {
  /** Permission action that must be allowed. */
  action: string;
  /** Callback returning the entity type or record to check. */
  subjectCallback: CanSubjectCallback<T>;
}
