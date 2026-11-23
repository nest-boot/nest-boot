import { formOptions, revalidateLogic } from "@tanstack/react-form";
import { getFormChanges } from "./form-changes";
import type { AnyFieldApi, AnyFormApi } from "@tanstack/react-form";
import type { FormEvent } from "react";

/** Advance saved defaults while keeping edits made during the request dirty. */
export function resetFormAfterSave<Values extends object>(
  form: Pick<AnyFormApi, "state" | "reset" | "setFieldValue">,
  submitted: Values,
  saved: Values = submitted,
) {
  const pendingChanges = getFormChanges(submitted, form.state.values);
  form.reset(saved);
  for (const [field, value] of Object.entries(pendingChanges)) {
    form.setFieldValue(field, value);
  }
}

/** Validate at first submit, then on changes; request errors use a separate slot. */
export const defaultFormOptions = formOptions({
  validationLogic: revalidateLogic({
    mode: "submit",
    modeAfterSubmission: "change",
  }),
  listeners: {
    onChange: ({ formApi }: { formApi: AnyFormApi }) =>
      formApi.setErrorMap({ onSubmit: undefined }),
  },
});

/** Preserve request errors on blur so the footer cannot move during a retry click. */
export function handleFieldBlur(
  field: Pick<AnyFieldApi, "form" | "setMeta" | "handleBlur">,
) {
  if (field.form.state.errorMap.onSubmit) {
    field.setMeta((previous) => ({
      ...previous,
      isTouched: true,
      isBlurred: true,
    }));
  } else {
    field.handleBlur();
  }
}

/** Keep Enter submission, retries, and focus scoped to the submitted HTML form. */
export async function submitForm(
  event: FormEvent<HTMLFormElement>,
  form: AnyFormApi,
  disabled = false,
) {
  event.preventDefault();
  event.stopPropagation();
  if (disabled || form.state.isSubmitting) return;
  const element = event.currentTarget;
  form.setErrorMap({ onSubmit: undefined });
  await form.handleSubmit();
  if (!form.state.isValid) {
    requestAnimationFrame(() => {
      element
        .querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)')
        ?.focus();
    });
  }
}
