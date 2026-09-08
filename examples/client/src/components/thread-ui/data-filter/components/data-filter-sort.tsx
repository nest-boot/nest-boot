import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import {
  getDataFilterSortFieldChoices,
  getDataFilterSortOptionByKey,
} from "../utils";
import type {
  DataFilterSortDirection,
  DataFilterSortOptions,
  DataFilterSortValue,
} from "../types";
import type { FC } from "react";
import { RadioGroup } from "@/components/thread-ui/radio-group";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface DataFilterSortProps {
  options: Array<DataFilterSortOptions>;
}

interface DataFilterSortViewProps extends DataFilterSortProps {
  selected?: DataFilterSortValue;
  onChange?: (selected: DataFilterSortValue) => void;
}

export const DataFilterSort: FC<DataFilterSortViewProps> = ({
  options,
  selected,
  onChange,
}) => {
  const [open, setOpen] = useState(false);

  const selectedKey = selected?.field ?? "";
  const selectedDirection = selected?.direction ?? "DESC";

  const fieldChoices = useMemo(() => {
    return getDataFilterSortFieldChoices(options, selected);
  }, [options, selected]);

  const selectedFieldChoice = fieldChoices.find((choice) => {
    return choice.option.field === selectedKey;
  });
  const selectedValue = selectedFieldChoice?.key;

  const directionChoices = useMemo(() => {
    return options.filter((option) => option.field === selectedKey);
  }, [options, selectedKey]);

  const handleFieldChange = (value: string) => {
    const option = getDataFilterSortOptionByKey(options, value);

    if (!option) {
      return;
    }

    onChange?.({
      field: option.field,
      direction: option.direction,
    });
  };

  const handleDirectionChange = (direction: DataFilterSortDirection) => {
    const match = options.find(
      (o) => o.field === selectedKey && o.direction === direction,
    );
    if (match) {
      onChange?.({ field: selectedKey, direction });
    }
  };

  return (
    <div className="flex" data-slot="data-filter-sort">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button className="shrink-0" size="icon" variant="outline">
              <ArrowUpDown className="size-4" />
            </Button>
          }
        />
        <PopoverContent align="end" className="w-64 p-0">
          <div>
            <div className="p-3 pb-2">
              <RadioGroup
                value={selectedValue}
                items={fieldChoices.map(({ key, option }) => ({
                  label: option.fieldLabel,
                  value: key,
                  disabled: option.disabled,
                }))}
                onValueChange={(val) => handleFieldChange(val)}
              />
            </div>

            {directionChoices.length > 0 && (
              <>
                <Separator />
                <div className="p-1">
                  {directionChoices.map((option) => {
                    const isActive = option.direction === selectedDirection;
                    return (
                      <button
                        key={`${option.field}:${option.direction}`}
                        disabled={option.disabled}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
                          option.disabled && "pointer-events-none opacity-50",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/50 text-muted-foreground",
                        )}
                        onClick={() => handleDirectionChange(option.direction)}
                      >
                        {option.direction === "ASC" ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        )}
                        {option.directionLabel}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
