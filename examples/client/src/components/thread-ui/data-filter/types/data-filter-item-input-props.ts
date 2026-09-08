import type { DataFilterItemBaseProps } from "./data-filter-item-base-props";
import type { DataFilterInputOperator } from "./data-filter-input-operator";

export interface DataFilterItemInputProps extends DataFilterItemBaseProps<
  string | null,
  DataFilterInputOperator
> {
  type: "input";
  placeholder?: string;
}
