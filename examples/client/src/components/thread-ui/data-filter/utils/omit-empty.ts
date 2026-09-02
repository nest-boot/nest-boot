import { omitBy } from "lodash";

import { isEmpty } from "./is-empty";

export const omitEmpty = (
  obj: Record<string, unknown>,
): Record<string, unknown> => omitBy(obj, isEmpty);
