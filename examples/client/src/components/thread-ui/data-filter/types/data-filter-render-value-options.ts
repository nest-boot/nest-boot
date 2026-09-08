import type { DataFilterOperator } from "./data-filter-operator";

export interface DataFilterRenderValueOptions<
  TValue = unknown,
  TOperator extends DataFilterOperator = DataFilterOperator,
> {
  label: string;
  field: string;
  operator: TOperator;
  value: TValue;
}
