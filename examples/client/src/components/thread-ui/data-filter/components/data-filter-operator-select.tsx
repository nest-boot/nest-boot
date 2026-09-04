import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getDataFilterBetweenValue,
  getDataFilterOperatorLabel,
  getDataFilterOperators,
} from "../utils";
import type { FC } from "react";

import type { DataFilterItemProps, DataFilterOperator } from "../types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const isUpperBoundOperator = (operator: DataFilterOperator) => {
  return operator === "$lt" || operator === "$lte";
};

interface DataFilterOperatorSelectProps {
  item: DataFilterItemProps;
  operator: DataFilterOperator;
  value: unknown;
  onChange: (operator: DataFilterOperator, value: unknown) => void;
}

export const DataFilterOperatorSelect: FC<DataFilterOperatorSelectProps> = ({
  item,
  operator,
  value,
  onChange,
}) => {
  const { t } = useTranslation("thread-ui");
  const operators = getDataFilterOperators(item);
  const selectedOperatorLabel =
    value === null && operator === "$eq"
      ? t("dataFilter.isEmpty")
      : value === null && operator === "$ne"
        ? t("dataFilter.isNotEmpty")
        : getDataFilterOperatorLabel(operator, t);

  const getNextValue = (nextOperator: string) => {
    if (value === null) {
      return undefined;
    }

    if (operator === "$between") {
      const [min, max] = getDataFilterBetweenValue(value);

      return nextOperator === "$lt" || nextOperator === "$lte"
        ? (max ?? min)
        : (min ?? max);
    }

    if (nextOperator === "$between") {
      return isUpperBoundOperator(operator)
        ? [undefined, value]
        : [value, undefined];
    }

    return value;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="xs" type="button" variant="ghost">
            <span>{selectedOperatorLabel}</span>
            <ChevronDown />
          </Button>
        }
      />

      <DropdownMenuContent align="start" className="w-64">
        {operators.map((itemOperator) => {
          return (
            <DropdownMenuItem
              key={itemOperator}
              onClick={() => {
                onChange(itemOperator, getNextValue(itemOperator));
              }}
            >
              {getDataFilterOperatorLabel(itemOperator, t)}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuItem
          onClick={() => {
            onChange("$eq", null);
          }}
        >
          {t("dataFilter.isEmpty")}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => {
            onChange("$ne", null);
          }}
        >
          {t("dataFilter.isNotEmpty")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
