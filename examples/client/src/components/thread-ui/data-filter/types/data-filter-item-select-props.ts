import type { DataFilterItemBaseProps } from "./data-filter-item-base-props";
import type {
  DataFilterResolveSelectedOptions,
  DataFilterSelectOptions,
} from "./data-filter-select-options";
import type { DataFilterSelectOperator } from "./data-filter-select-operator";

export interface DataFilterItemSelectProps extends DataFilterItemBaseProps<
  Array<string> | null,
  DataFilterSelectOperator
> {
  type: "select";
  options: DataFilterSelectOptions;
  resolveSelectedOptions?: DataFilterResolveSelectedOptions;
  placeholder?: string;
}
