import {
  getDataFilterDate,
  getDataFilterDateDisabled,
  getDataFilterDateRange,
  getDataFilterDateRangeValue,
} from "../utils";
import type { FC } from "react";

import type {
  DataFilterDatePickerBetweenValue,
  DataFilterItemDatePickerProps,
  DataFilterOperator,
} from "../types";
import { Calendar } from "@/components/thread-ui/calendar";

type DataFilterDefaultDatePickerFieldValue =
  | DataFilterDatePickerBetweenValue
  | Date
  | string
  | undefined;

interface DataFilterDefaultDatePickerFieldProps {
  item: DataFilterItemDatePickerProps;
  operator: DataFilterOperator;
  value: DataFilterDefaultDatePickerFieldValue;
  onChange: (value: DataFilterDefaultDatePickerFieldValue) => void;
}

export const DataFilterDefaultDatePickerField: FC<
  DataFilterDefaultDatePickerFieldProps
> = ({ item, operator, value, onChange }) => {
  const selected = getDataFilterDate(value);
  const disabled = getDataFilterDateDisabled({
    min: item.min,
    max: item.max,
  });

  if (operator === "$between") {
    const [from, to] = getDataFilterDateRange(value);
    const selectedRange = {
      from,
      to,
    };

    return (
      <Calendar
        className="p-0 px-2 pb-2"
        defaultMonth={selectedRange.from ?? selectedRange.to}
        disabled={disabled}
        mode="range"
        selected={selectedRange}
        onSelect={(dateRange) => {
          onChange(getDataFilterDateRangeValue(dateRange));
        }}
      />
    );
  }

  return (
    <Calendar
      className="p-0 px-2 pb-2"
      defaultMonth={selected}
      disabled={disabled}
      mode="single"
      selected={selected}
      onSelect={(date) => {
        onChange(date ? date.toISOString() : undefined);
      }}
    />
  );
};
