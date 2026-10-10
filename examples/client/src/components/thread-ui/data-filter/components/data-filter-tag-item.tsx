import { ChevronDown } from "lucide-react";
import { useState } from "react";

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
import { DataFilterRemoveAction } from "./data-filter-remove-action";
import {
  DataFilterPopover,
  DataFilterPopoverBody,
  DataFilterPopoverContent,
  DataFilterPopoverHeader,
  DataFilterPopoverTrigger,
} from "./data-filter-popover";
import type {
  DataFilterField,
  DataFilterItemBaseProps,
  DataFilterOperator,
} from "../types";
import type { FC, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DataFilterTagItemProps {
  item: DataFilterField;
  defaultOpen?: boolean;
  showRemoveAction?: boolean;
  onRemove?: () => void;
}

export const DataFilterTagItem: FC<DataFilterTagItemProps> = ({
  item,
  defaultOpen,
  showRemoveAction = true,
  onRemove,
}) => {
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
  const [open, setOpen] = useState(
    defaultOpen ?? isEmptyDataFilterValue(fieldValue),
  );
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

  const getValue = (): ReactNode => {
    if (rawValue === null) {
      return undefined;
    }

    if (isFieldValueEmpty || isEmpty(rawValue)) {
      return undefined;
    }

    return renderValue
      ? renderValue({ field, label, operator, value: rawValue })
      : String(getDefaultValue());
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
    setOpen(false);
    if (onRemove) {
      onRemove();
    } else {
      removeFilter(field);
    }
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
  const labelValue = (
    <>
      {label} {operatorLabel}
      {value != null && value !== false && <> {value}</>}
    </>
  );

  return (
    <DataFilterPopover
      key={field}
      modal={true}
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
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
              <DataFilterPopoverTrigger
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

      <DataFilterPopoverContent aria-label={label}>
        <DataFilterPopoverHeader>
          <DataFilterOperatorSelect
            item={item}
            operator={operator}
            value={rawValue}
            onChange={handleOperatorChange}
          />

          {showRemoveAction && <DataFilterRemoveAction onClick={remove} />}
        </DataFilterPopoverHeader>

        {shouldRenderContent && (
          <DataFilterPopoverBody>
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
          </DataFilterPopoverBody>
        )}
      </DataFilterPopoverContent>
    </DataFilterPopover>
  );
};
