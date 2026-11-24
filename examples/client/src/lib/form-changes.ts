import { isEqual } from "lodash-es";

export interface FormChangesOptions<Values> {
  /** Fields whose array order has no meaning, such as roles and permissions. */
  setFields?: ReadonlyArray<keyof Values>;
}

/** Compare normalized values with the form's baseline, preserving explicit clears. */
export function getFormChanges<Values extends object>(
  initial: Values,
  values: Values,
  { setFields = [] }: FormChangesOptions<Values> = {},
): Partial<Values> {
  const changes: Partial<Values> = {};
  for (const key of Object.keys(values) as Array<keyof Values>) {
    const before = initial[key];
    const after = values[key];
    const equal =
      setFields.includes(key) && Array.isArray(before) && Array.isArray(after)
        ? isEqual(new Set(before), new Set(after))
        : isEqual(before, after);
    if (!equal) changes[key] = after;
  }
  return changes;
}
