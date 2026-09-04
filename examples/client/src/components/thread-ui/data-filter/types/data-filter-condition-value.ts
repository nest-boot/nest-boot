import type { DataFilterOperator } from "./data-filter-operator";

export type DataFilterConditionValue = Partial<
  Record<DataFilterOperator, unknown>
>;
