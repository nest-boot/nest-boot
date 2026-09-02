import type { DataFilterOperator } from "./data-filter-operator";

export interface DataFilterRenderContext<
  TValue = unknown,
  TOperator extends DataFilterOperator = DataFilterOperator,
> {
  operator: TOperator;
  field: {
    value: TValue | undefined;
    onChange: (value: TValue | undefined) => void;
  };
}
