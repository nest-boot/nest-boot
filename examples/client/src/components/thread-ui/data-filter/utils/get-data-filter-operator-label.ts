import type { DataFilterOperator } from "../types";
import type { TFunction } from "i18next";

export const getDataFilterOperatorLabel = (
  operator: DataFilterOperator,
  t: TFunction,
): string => {
  switch (operator) {
    case "$eq":
      return t("thread-ui:dataFilter.operators.$eq");
    case "$ne":
      return t("thread-ui:dataFilter.operators.$ne");
    case "$gt":
      return t("thread-ui:dataFilter.operators.$gt");
    case "$gte":
      return t("thread-ui:dataFilter.operators.$gte");
    case "$lt":
      return t("thread-ui:dataFilter.operators.$lt");
    case "$lte":
      return t("thread-ui:dataFilter.operators.$lte");
    case "$between":
      return t("thread-ui:dataFilter.operators.$between");
    case "$fulltext":
      return t("thread-ui:dataFilter.operators.$fulltext");
    case "$in":
      return t("thread-ui:dataFilter.operators.$in");
    case "$nin":
      return t("thread-ui:dataFilter.operators.$nin");
  }
};
