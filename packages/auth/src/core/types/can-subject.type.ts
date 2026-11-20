import type { Subject, SubjectType } from "@casl/ability";

import type { CanSubjectCallback } from "./can-subject-callback.type.js";

/** Static permission subject type or callback resolving a subject during request handling. */
export type CanSubject<
  T extends Subject = Subject,
  TSelf = unknown,
  TArgs extends unknown[] = unknown[],
> = SubjectType | CanSubjectCallback<T, TSelf, TArgs>;
