import { useId } from "react";
import type { ComponentProps, FC } from "react";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea as TextareaComponent } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type TextareaProps = ComponentProps<typeof TextareaComponent> & {
  label?: string;
  description?: string;
  error?: string;
};

export const Textarea: FC<TextareaProps> = ({
  label,
  description,
  error,
  className,
  id: idProp,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}) => {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const descriptionId = `${id}-description`;
  const describedBy =
    [ariaDescribedBy, error || description ? descriptionId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <Field
      className={cn(className)}
      data-disabled={props.disabled}
      data-invalid={!!error}
    >
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}

      <TextareaComponent
        {...props}
        aria-describedby={describedBy}
        aria-invalid={error ? true : ariaInvalid}
        id={id}
      />

      {(error || description) && (
        <FieldDescription
          className={cn(error && "text-destructive")}
          id={descriptionId}
          role={error ? "alert" : undefined}
        >
          {error || description}
        </FieldDescription>
      )}
    </Field>
  );
};
