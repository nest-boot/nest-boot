import type { DataFilterOperator } from "../types";

export const dataFilterAllOperators: Array<DataFilterOperator> = [
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$between",
  "$fulltext",
  "$in",
  "$nin",
];
