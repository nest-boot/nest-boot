import { dataFilterAllOperators } from "./data-filter-all-operators";
import type { DataFilterOperator } from "../types";

export const isDataFilterOperator = (
  value: string,
): value is DataFilterOperator => {
  return dataFilterAllOperators.includes(value as DataFilterOperator);
};
