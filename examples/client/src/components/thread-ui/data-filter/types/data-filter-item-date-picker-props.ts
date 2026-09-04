import type { DataFilterItemBaseProps } from "./data-filter-item-base-props";
import type { DataFilterDatePickerBetweenValue } from "./data-filter-date-picker-between-value";
import type { DataFilterDatePickerOperator } from "./data-filter-date-picker-operator";

export interface DataFilterItemDatePickerProps extends DataFilterItemBaseProps<
  DataFilterDatePickerBetweenValue | Date | string | null,
  DataFilterDatePickerOperator
> {
  type: "date-picker";
  min?: Date | string;
  max?: Date | string;
  placeholder?: string;
}
