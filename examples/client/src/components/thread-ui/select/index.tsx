"use client";

import { useId } from "react";
import type { SelectRootProps } from "@base-ui/react/select";
import type { ReactNode } from "react";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  SelectContent,
  SelectItem,
  Select as SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SelectItemProps = {
  label: ReactNode;
  value: string;
};

export type SelectProps<
  Value,
  Multiple extends boolean | undefined = false,
> = SelectRootProps<Value, Multiple> & {
  label?: string;
  description?: string;
  error?: string;
  placeholder?: string;
  items: Array<SelectItemProps>;
  className?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

export function Select<Value, Multiple extends boolean | undefined = false>({
  label,
  description,
  error,
  placeholder,
  items,
  className,
  disabled,
  id: idProp,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: SelectProps<Value, Multiple>) {
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
      data-disabled={disabled}
      data-invalid={!!error}
    >
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}

      <SelectRoot disabled={disabled} items={items} {...props}>
        <SelectTrigger
          aria-describedby={describedBy}
          aria-invalid={!!error}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          id={id}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>

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
}
