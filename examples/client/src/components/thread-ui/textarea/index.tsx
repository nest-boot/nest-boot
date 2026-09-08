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
  ...props
}) => {
  return (
    <Field
      className={cn(className)}
      data-disabled={props.disabled}
      data-invalid={!!error}
    >
      {label && <FieldLabel htmlFor={props.id}>{label}</FieldLabel>}

      <TextareaComponent aria-invalid={!!error} {...props} />

      {(error || description) && (
        <FieldDescription className={cn(error && "text-destructive")}>
          {error || description}
        </FieldDescription>
      )}
    </Field>
  );
};
