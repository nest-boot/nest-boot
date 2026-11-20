import type { Subject, SubjectType } from "@casl/ability";

import type { CanSubjectCallback } from "../../core/types/can-subject-callback.type.js";

/** Route metadata produced by the unified Can decorator. */
export type CanMetadata<T extends Subject = Subject> =
  | {
      /** Permission action that must be allowed. */
      action: string;
      /** Static entity class or subject name to check. */
      subject: SubjectType;
      subjectCallback?: never;
    }
  | {
      /** Permission action that must be allowed. */
      action: string;
      /** Callback returning the entity type or record to check. */
      subjectCallback: CanSubjectCallback<T>;
      subject?: never;
    };
