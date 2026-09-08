import { ChevronDown, Trash2 } from "lucide-react";

import { useTranslation } from "react-i18next";
import {
  createDataFilterCondition,
  getDataFilterCondition,
  getDataFilterDefaultRenderValue,
  getDataFilterOperatorLabel,
  getDataFilterOperators,
  getDefaultDataFilterOperator,
  isEmpty,
  isEmptyDataFilterValue,
} from "../utils";
import { useDataFilterContext } from "./data-filter-context";
import { DataFilterDefaultField } from "./data-filter-default-field";
import { DataFilterOperatorSelect } from "./data-filter-operator-select";
import type {
  DataFilterItemBaseProps,
  DataFilterItemProps,
  DataFilterOperator,
} from "../types";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DataFilterTagItemProps {
  item: DataFilterItemProps;
}

export const DataFilterTagItem: FC<DataFilterTagItemProps> = ({ item }) => {
  const { field, label } = item;
  const { t } = useTranslation("thread-ui");
  const {
    filterValues,
    selectOptionCache,
    setFilterValue,
    hideFilter,
    removeFilter,
  } = useDataFilterContext();
  const fieldValue = filterValues[field];
  const operators = getDataFilterOperators(item);
  const getOperator = (value: unknown): DataFilterOperator => {
    const condition = getDataFilterCondition(value);
    const isEmptyCondition =
      condition.value === null &&
      (condition.operator === "$eq" || condition.operator === "$ne");

    return condition.operator &&
      (operators.includes(condition.operator) || isEmptyCondition)
      ? condition.operator
      : getDefaultDataFilterOperator(item);
  };
  const operator = getOperator(fieldValue);
  const rawValue = getDataFilterCondition(fieldValue).value;
  const renderValue = item.renderValue as
    | DataFilterItemBaseProps<unknown>["renderValue"]
    | undefined;

  const getDefaultValue = (): unknown => {
    return getDataFilterDefaultRenderValue({
      field,
      item,
      checkedLabel: t("dataFilter.checked"),
      operator,
      selectOptionCache: selectOptionCache[field],
      uncheckedLabel: t("dataFilter.unchecked"),
      value: rawValue,
    });
  };

  const getValue = (): string | undefined => {
    if (rawValue === null) {
      return undefined;
    }

    if (isFieldValueEmpty || isEmpty(rawValue)) {
      return undefined;
    }

    return String(
      typeof renderValue !== "undefined"
        ? renderValue({
            field,
            label,
            operator,
            value: rawValue,
          })
        : getDefaultValue(),
    );
  };

  const handleOperatorChange = (
    nextOperator: DataFilterOperator,
    value: unknown,
  ) => {
    setFilterValue(field, createDataFilterCondition(nextOperator, value));
  };

  const handleValueChange = (value: unknown) => {
    setFilterValue(field, createDataFilterCondition(operator, value));
  };

  const remove = () => {
    removeFilter(field);
  };

  const render = item.render as
    | DataFilterItemBaseProps<unknown>["render"]
    | undefined;
  const isFieldValueEmpty = isEmptyDataFilterValue(fieldValue);
  const value = getValue();
  const operatorLabel =
    rawValue === null && operator === "$eq"
      ? t("dataFilter.isEmpty")
      : rawValue === null && operator === "$ne"
        ? t("dataFilter.isNotEmpty")
        : getDataFilterOperatorLabel(operator, t);
  const shouldRenderContent = rawValue !== null;
  const labelValue = value
    ? `${label} ${operatorLabel} ${value}`
    : `${label} ${operatorLabel}`;

  return (
    <Popover
      key={field}
      defaultOpen={isFieldValueEmpty}
      modal={true}
      onOpenChange={(open) => {
        // Remove empty filters when their popover closes.
        if (!open && isFieldValueEmpty) {
          hideFilter(field);
        }
      }}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Button
                    className="max-w-72 min-w-0"
                    size="xs"
                    variant="secondary"
                  >
                    <span className="truncate">{labelValue}</span>
                    <ChevronDown />
                  </Button>
                }
              />
            }
          />
          <TooltipContent>{labelValue}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent
        align="start"
        className="grid w-fit max-w-64 min-w-48 gap-1 p-1"
      >
        <div
          className="flex items-center justify-between"
          data-slot="data-filter-tag-item-header"
        >
          <DataFilterOperatorSelect
            item={item}
            operator={operator}
            value={rawValue}
            onChange={handleOperatorChange}
          />

          <Button
            aria-label={t("dataFilter.removeFilter")}
            size="icon-xs"
            variant="ghost"
            onClick={remove}
          >
            <Trash2 />
          </Button>
        </div>

        {shouldRenderContent && (
          <div data-slot="data-filter-tag-item-content">
            {render ? (
              render({
                operator,
                field: {
                  value: rawValue,
                  onChange: handleValueChange,
                },
              })
            ) : (
              <DataFilterDefaultField
                item={item}
                operator={operator}
                value={rawValue}
                onChange={handleValueChange}
              />
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
