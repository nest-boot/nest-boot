import type { Subject } from "@casl/ability";
import type { Type } from "@nestjs/common";

import type { CanSubjectFactory } from "./can-subject-factory.type.js";

/** Permission subject type or subject resolver factory. */
export type CanSubject<T extends Subject = Subject> =
  | Type<T>
  | CanSubjectFactory<T>;
