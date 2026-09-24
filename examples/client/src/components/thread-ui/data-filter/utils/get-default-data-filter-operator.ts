import { getDataFilterOperators } from "./get-data-filter-operators";
import type { DataFilterField, DataFilterOperator } from "../types";

export const getDefaultDataFilterOperator = (
  item: DataFilterField,
): DataFilterOperator => {
  return item.defaultOperator ?? getDataFilterOperators(item)[0] ?? "$eq";
};
