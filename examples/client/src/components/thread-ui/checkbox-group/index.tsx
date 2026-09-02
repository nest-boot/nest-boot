"use client";

import { CheckboxGroup as CheckboxGroupPrimitive } from "@base-ui/react/checkbox-group";
import type {
  CheckboxGroupChangeEventDetails,
  CheckboxGroupProps as CheckboxGroupPrimitiveProps,
} from "@base-ui/react/checkbox-group";
import type { ComponentProps, ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type CheckboxGroupOptionProps<Value extends string> = {
  label: ReactNode;
  description?: ReactNode;
  value: Value;
  disabled?: boolean;
};

export type CheckboxGroupParentProps = {
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
};

export type CheckboxGroupItemProps = ComponentProps<typeof Checkbox> & {
  children: ReactNode;
  description?: ReactNode;
};

type CheckboxGroupBaseProps<Value extends string> = Omit<
  CheckboxGroupPrimitiveProps,
  "allValues" | "children" | "defaultValue" | "onValueChange" | "value"
> & {
  name?: string;
  label?: ReactNode;
  description?: ReactNode;
  value?: Array<Value>;
  defaultValue?: Array<Value>;
  onValueChange?: (
    value: Array<Value>,
    eventDetails: CheckboxGroupChangeEventDetails,
  ) => void;
};

export type CheckboxGroupProps<Value extends string> =
  CheckboxGroupBaseProps<Value> &
    (
      | {
          allValues?: never;
          children?: never;
          items: Array<CheckboxGroupOptionProps<Value>>;
          parent?: CheckboxGroupParentProps;
        }
      | {
          allValues?: Array<Value>;
          children: ReactNode;
          items?: never;
          parent?: never;
        }
    );

export function CheckboxGroupItem({
  children,
  description,
  disabled,
  ...props
}: CheckboxGroupItemProps) {
  return (
    <Field data-disabled={disabled} orientation="horizontal">
      <Checkbox disabled={disabled} {...props} />
      <FieldContent>
        <FieldLabel>{children}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
    </Field>
  );
}

export function CheckboxGroup<Value extends string>({
  allValues,
  children,
  className,
  defaultValue,
  description,
  disabled,
  items = [],
  label,
  name,
  onValueChange,
  parent,
  value,
  ...props
}: CheckboxGroupProps<Value>) {
  const values = items.map((item) => item.value);

  return (
    <FieldSet className={cn(className)}>
      {label && <FieldLegend variant="label">{label}</FieldLegend>}
      {description && <FieldDescription>{description}</FieldDescription>}

      <CheckboxGroupPrimitive
        allValues={children !== undefined ? allValues : values}
        className="grid w-full gap-2"
        data-slot="checkbox-group"
        defaultValue={defaultValue}
        disabled={disabled}
        value={value}
        {...props}
        onValueChange={(nextValue, eventDetails) => {
          onValueChange?.(nextValue as Array<Value>, eventDetails);
        }}
      >
        {children !== undefined ? (
          children
        ) : (
          <>
            {parent && (
              <CheckboxGroupItem
                parent
                description={parent.description}
                disabled={disabled || parent.disabled}
              >
                {parent.label}
              </CheckboxGroupItem>
            )}

            {items.map((item) => (
              <CheckboxGroupItem
                key={item.value}
                description={item.description}
                disabled={disabled || item.disabled}
                name={name}
                value={item.value}
              >
                {item.label}
              </CheckboxGroupItem>
            ))}
          </>
        )}
      </CheckboxGroupPrimitive>
    </FieldSet>
  );
}
