import { DataFilterDefaultCheckboxField } from "./data-filter-default-checkbox-field";
import { DataFilterDefaultDatePickerField } from "./data-filter-default-date-picker-field";
import { DataFilterDefaultInputField } from "./data-filter-default-input-field";
import { DataFilterDefaultNumberInputField } from "./data-filter-default-number-input-field";
import { DataFilterDefaultSelectField } from "./data-filter-default-select-field";
import type { FC } from "react";

import type {
  DataFilterDatePickerBetweenValue,
  DataFilterItemProps,
  DataFilterNumberInputBetweenValue,
  DataFilterOperator,
} from "../types";

const getInputValue = (value: unknown) => {
  return typeof value === "string" ? value : undefined;
};

const getNumberInputRangeValue = (
  value: Array<unknown>,
): DataFilterNumberInputBetweenValue => {
  return [
    typeof value[0] === "number" ? value[0] : undefined,
    typeof value[1] === "number" ? value[1] : undefined,
  ];
};

const getNumberInputValue = (
  value: unknown,
): DataFilterNumberInputBetweenValue | number | undefined => {
  if (Array.isArray(value)) {
    return getNumberInputRangeValue(value);
  }

  return typeof value === "number" ? value : undefined;
};

const isDatePickerValue = (value: unknown): value is Date | string => {
  return value instanceof Date || typeof value === "string";
};

const getDatePickerRangeValue = (
  value: Array<unknown>,
): DataFilterDatePickerBetweenValue => {
  return [
    isDatePickerValue(value[0]) ? value[0] : undefined,
    isDatePickerValue(value[1]) ? value[1] : undefined,
  ];
};

const getDatePickerValue = (
  value: unknown,
): DataFilterDatePickerBetweenValue | Date | string | undefined => {
  if (Array.isArray(value)) {
    return getDatePickerRangeValue(value);
  }

  return isDatePickerValue(value) ? value : undefined;
};

const getCheckboxValue = (value: unknown) => {
  return typeof value === "boolean" ? value : undefined;
};

const getSelectValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.filter((optionValue): optionValue is string => {
      return typeof optionValue === "string";
    });
  }

  return typeof value === "string" ? value : undefined;
};

interface DataFilterDefaultFieldProps {
  item: DataFilterItemProps;
  operator: DataFilterOperator;
  value: unknown;
  onChange: (value: unknown) => void;
}

export const DataFilterDefaultField: FC<DataFilterDefaultFieldProps> = ({
  item,
  operator,
  value,
  onChange,
}) => {
  if (item.type === "number-input") {
    return (
      <DataFilterDefaultNumberInputField
        item={item}
        operator={operator}
        value={getNumberInputValue(value)}
        onChange={onChange}
      />
    );
  }

  if (item.type === "date-picker") {
    return (
      <DataFilterDefaultDatePickerField
        item={item}
        operator={operator}
        value={getDatePickerValue(value)}
        onChange={onChange}
      />
    );
  }

  if (item.type === "checkbox") {
    return (
      <DataFilterDefaultCheckboxField
        value={getCheckboxValue(value)}
        onChange={onChange}
      />
    );
  }

  if (item.type === "select") {
    return (
      <DataFilterDefaultSelectField
        item={item}
        value={getSelectValue(value)}
        onChange={onChange}
      />
    );
  }

  return (
    <DataFilterDefaultInputField
      item={item}
      value={getInputValue(value)}
      onChange={onChange}
    />
  );
};
