import type {
  RadioGroupChangeEventDetails,
  RadioGroupProps as RadioGroupPrimitiveProps,
} from "@base-ui/react";
import type { ReactNode } from "react";

import {
  RadioGroup as RadioGroupComponent,
  RadioGroupItem as RadioGroupItemComponent,
} from "@/components/ui/radio-group";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type RadioGroupOptionProps<Value extends string | null> = {
  label: ReactNode;
  description?: string;
  value: Value;
  disabled?: boolean;
};

export type RadioGroupItemProps<Value extends string | null> = Omit<
  RadioGroupOptionProps<Value>,
  "label"
> & {
  children: ReactNode;
};

type RadioGroupBaseProps<Value extends string | null> = Omit<
  RadioGroupPrimitiveProps,
  "children" | "defaultValue" | "onValueChange" | "value"
> & {
  label?: string;
  description?: string;
  value?: Value;
  defaultValue?: Value;
  onValueChange?: (
    value: Value,
    eventDetails: RadioGroupChangeEventDetails,
  ) => void;
};

export type RadioGroupProps<Value extends string | null> =
  RadioGroupBaseProps<Value> &
    (
      | {
          children?: never;
          items: Array<RadioGroupOptionProps<Value>>;
        }
      | {
          children: ReactNode;
          items?: never;
        }
    );

export function RadioGroupItem<Value extends string | null>({
  children,
  description,
  disabled,
  value,
}: RadioGroupItemProps<Value>) {
  return (
    <Field data-disabled={disabled} orientation="horizontal">
      <RadioGroupItemComponent disabled={disabled} value={value} />
      <FieldContent>
        <FieldLabel>{children}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
    </Field>
  );
}

export function RadioGroup<Value extends string | null>({
  className,
  label,
  description,
  disabled,
  children,
  items = [],
  ...props
}: RadioGroupProps<Value>) {
  return (
    <FieldSet className={cn(className)}>
      {label && <FieldLegend variant="label">{label}</FieldLegend>}
      {description && <FieldDescription>{description}</FieldDescription>}

      <RadioGroupComponent disabled={disabled} {...props}>
        {children !== undefined
          ? children
          : items.map((item) => (
              <RadioGroupItem
                key={item.value}
                description={item.description}
                disabled={disabled || item.disabled}
                value={item.value}
              >
                {item.label}
              </RadioGroupItem>
            ))}
      </RadioGroupComponent>
    </FieldSet>
  );
}
