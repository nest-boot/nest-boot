import type { DataFilterOperator } from "../types";
import type { TFunction } from "i18next";

export const getDataFilterOperatorLabel = (
  operator: DataFilterOperator,
  t: TFunction,
): string => {
  switch (operator) {
    case "$eq":
      return t("dataFilter.operators.$eq");
    case "$ne":
      return t("dataFilter.operators.$ne");
    case "$gt":
      return t("dataFilter.operators.$gt");
    case "$gte":
      return t("dataFilter.operators.$gte");
    case "$lt":
      return t("dataFilter.operators.$lt");
    case "$lte":
      return t("dataFilter.operators.$lte");
    case "$between":
      return t("dataFilter.operators.$between");
    case "$fulltext":
      return t("dataFilter.operators.$fulltext");
    case "$in":
      return t("dataFilter.operators.$in");
    case "$nin":
      return t("dataFilter.operators.$nin");
  }
};
