import { useState } from "react";
import type { FormChangesOptions } from "@/lib/form-changes";
import { getFormChanges } from "@/lib/form-changes";

/** Keep the comparison baseline stable while queries refresh or other cards save. */
export function useFormChanges<Values extends object>(
  initial: Values,
  options?: FormChangesOptions<Values>,
) {
  const [defaultValues, accept] = useState(() => structuredClone(initial));
  return {
    defaultValues,
    getChanges: (values: Values) =>
      getFormChanges(defaultValues, values, options),
    // Advance only after a successful save, together with form.reset(values).
    accept: (values: Values) => accept(structuredClone(values)),
  };
}
