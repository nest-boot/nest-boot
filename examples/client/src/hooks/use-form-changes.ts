import { useEffect, useRef, useState } from "react";
import { useSelector } from "@tanstack/react-form";
import { getFormChanges } from "@/lib/form-changes";
import type { AnyFormApi } from "@tanstack/react-form";
import type { FormChangesOptions } from "@/lib/form-changes";

/** Track the edit baseline separately from incoming server snapshots. */
export function useFormChanges<Values extends object>(
  initial: Values,
  options: FormChangesOptions<Values> & {
    revision: string | number | undefined;
    normalize?: (values: Values) => Values;
  },
) {
  const normalize = options.normalize ?? ((values: Values) => values);
  const baseline = useRef(structuredClone(normalize(initial)));
  const [defaultValues, setDefaultValues] = useState(baseline.current);
  const lastRevision = useRef(options.revision);
  const accept = (values: Values) => {
    const saved = structuredClone(normalize(values));
    baseline.current = saved;
    setDefaultValues(saved);
  };
  return {
    defaultValues,
    getChanges: (values: Values) =>
      getFormChanges(baseline.current, normalize(values), options),
    // Advance only after a successful save, together with resetFormAfterSave.
    accept,
    normalize,
    /** Sync refreshed metadata from an effect, preserving edits and request errors. */
    sync: (form: AnyFormApi) => {
      if (
        form.state.isSubmitting ||
        Object.is(lastRevision.current, options.revision)
      )
        return;
      lastRevision.current = options.revision;
      const incoming = normalize(initial);
      const fields = Object.keys(initial) as Array<keyof Values & string>;
      const current = Object.fromEntries(
        fields.map((field) => [field, form.state.values[field]]),
      ) as Values;
      const draft = getFormChanges(
        baseline.current,
        normalize(current),
        options,
      );
      form.update({
        ...form.options,
        defaultValues: { ...form.options.defaultValues, ...incoming },
      });
      for (const field of fields) {
        form.setFieldValue(
          field,
          Object.hasOwn(draft, field) ? current[field] : incoming[field],
          { dontUpdateMeta: true, dontRunListeners: true, dontValidate: true },
        );
      }
      accept(incoming);
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
