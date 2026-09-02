"use client";

import type { ComponentProps, FC } from "react";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input as InputComponent } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type InputProps = ComponentProps<typeof InputComponent> & {
  label?: string;
  description?: string;
  error?: string;
};

export const Input: FC<InputProps> = ({
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

      <InputComponent aria-invalid={!!error} {...props} />

      {(error || description) && (
        <FieldDescription className={cn(error && "text-destructive")}>
          {error || description}
        </FieldDescription>
      )}
    </Field>
  );
};
