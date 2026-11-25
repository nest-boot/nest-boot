import { useSelector } from "@tanstack/react-form";
import { Button } from "@/components/thread-ui/button";
import type { AnyFormApi } from "@tanstack/react-form";
import type { ButtonProps } from "@/components/thread-ui/button";

/** Subscribe locally; request errors allow retries, while schemas guard writes. */
export function SubmitButton({
  formApi,
  requireDirty = false,
  disabled,
  loading,
  ...props
}: ButtonProps & {
  formApi: Pick<AnyFormApi, "store">;
  requireDirty?: boolean;
}) {
  const isSubmitting = useSelector(
    formApi.store,
    (state) => state.isSubmitting,
  );
  const unchanged = useSelector(
    formApi.store,
    (state) => requireDirty && !state.isDirty,
  );
  const invalid = useSelector(
    formApi.store,
    (state) => !state.canSubmit && !state.errorMap.onSubmit,
  );
  return (
    <Button
      {...props}
      type="submit"
      disabled={disabled || unchanged}
      loading={loading || isSubmitting}
      aria-disabled={invalid || undefined}
    />
  );
}
