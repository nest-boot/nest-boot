import type { ReactElement, ReactNode } from "react";

import type { DataFilterRenderContext } from "./data-filter-render-context";
import type { DataFilterRenderValueOptions } from "./data-filter-render-value-options";
import type { DataFilterOperator } from "./data-filter-operator";

export interface DataFilterItemBaseProps<
  TValue = unknown,
  TOperator extends DataFilterOperator = DataFilterOperator,
> {
  label: string;
  field: string;
  operators?: Array<TOperator>;
  defaultOperator?: TOperator;
  render?: (
    options: DataFilterRenderContext<TValue, TOperator>,
  ) => ReactElement;
  renderValue?: (
    options: DataFilterRenderValueOptions<TValue, TOperator>,
  ) => ReactNode;
}
