import type { DataFilterItemCheckboxProps } from "./data-filter-item-checkbox-props";
import type { DataFilterItemDatePickerProps } from "./data-filter-item-date-picker-props";
import type { DataFilterItemInputProps } from "./data-filter-item-input-props";
import type { DataFilterItemNumberInputProps } from "./data-filter-item-number-input-props";
import type { DataFilterItemSelectProps } from "./data-filter-item-select-props";

export type DataFilterItemProps =
  | DataFilterItemInputProps
  | DataFilterItemNumberInputProps
  | DataFilterItemDatePickerProps
  | DataFilterItemCheckboxProps
  | DataFilterItemSelectProps;
