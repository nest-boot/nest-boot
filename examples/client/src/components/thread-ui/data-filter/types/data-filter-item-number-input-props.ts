import type { DataFilterItemBaseProps } from "./data-filter-item-base-props";
import type { DataFilterNumberInputBetweenValue } from "./data-filter-number-input-between-value";
import type { DataFilterNumberInputOperator } from "./data-filter-number-input-operator";

export interface DataFilterItemNumberInputProps extends DataFilterItemBaseProps<
  DataFilterNumberInputBetweenValue | number | null,
  DataFilterNumberInputOperator
> {
  type: "number-input";
  min?: number;
  max?: number;
  step?: number;
  decimalScale?: number;
  fixedDecimalScale?: boolean;
  placeholder?: string;
}
