import { useEffect, useRef, useState } from "react";
import { useSelector } from "@tanstack/react-form";
import type { AnyFormApi } from "@tanstack/react-form";
import type { FormChangesOptions } from "@/lib/form-changes";
import { getFormChanges } from "@/lib/form-changes";

/** Track the edit baseline separately from incoming server snapshots. */
export function useFormChanges<Values extends object>(
  initial: Values,
  options?: FormChangesOptions<Values>,
) {
  const [defaultValues, accept] = useState(() => structuredClone(initial));
  const lastServerValues = useRef(structuredClone(initial));
  return {
    defaultValues,
    getChanges: (values: Values) =>
      getFormChanges(defaultValues, values, options),
    // Advance only after a successful save, together with resetFormAfterSave.
    accept: (values: Values) => accept(structuredClone(values)),
    /** Sync refreshed metadata from an effect, preserving edits and request errors. */
    sync: (form: AnyFormApi) => {
      if (
        form.state.isSubmitting ||
        !Object.keys(getFormChanges(lastServerValues.current, initial, options))
          .length
      )
        return;
      lastServerValues.current = structuredClone(initial);
      const fields = Object.keys(initial) as Array<keyof Values & string>;
      const current = Object.fromEntries(
        fields.map((field) => [field, form.state.values[field]]),
      ) as Values;
      const draft = getFormChanges(defaultValues, current, options);
      form.update({
        ...form.options,
        defaultValues: { ...form.options.defaultValues, ...initial },
      });
      for (const field of fields) {
        form.setFieldValue(
          field,
          Object.hasOwn(draft, field) ? current[field] : initial[field],
          { dontUpdateMeta: true, dontRunListeners: true, dontValidate: true },
        );
      }
      accept(structuredClone(initial));
    },
  };
}

/** Apply server refreshes after rendering and after any pending submission finishes. */
export function useSyncFormChanges(
  form: AnyFormApi,
  changes: { sync: (form: AnyFormApi) => void },
  enabled = true,
) {
  const submitting = useSelector(form.store, (state) => state.isSubmitting);
  useEffect(() => {
    if (enabled) changes.sync(form);
  }, [changes, enabled, form, submitting]);
}
