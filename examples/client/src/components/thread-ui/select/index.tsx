"use client";

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
};

export function Select<Value, Multiple extends boolean | undefined = false>({
  label,
  description,
  error,
  placeholder,
  items,
  className,
  disabled,
  ...props
}: SelectProps<Value, Multiple>) {
  return (
    <Field
      className={cn(className)}
      data-disabled={disabled}
      data-invalid={!!error}
    >
      {label && <FieldLabel>{label}</FieldLabel>}

      <SelectRoot disabled={disabled} items={items} {...props}>
        <SelectTrigger aria-invalid={!!error}>
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
        <FieldDescription className={cn(error && "text-destructive")}>
          {error || description}
        </FieldDescription>
      )}
    </Field>
  );
}
