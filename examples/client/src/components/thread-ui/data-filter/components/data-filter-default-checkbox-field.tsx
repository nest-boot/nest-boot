import { CheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FC } from "react";

interface DataFilterDefaultCheckboxFieldProps {
  value?: boolean;
  onChange: (value: boolean) => void;
}

export const DataFilterDefaultCheckboxField: FC<
  DataFilterDefaultCheckboxFieldProps
> = ({ value, onChange }) => {
  const { t } = useTranslation("thread-ui");

  return (
    <div className="grid">
      {[
        { label: t("dataFilter.unchecked"), value: false },
        { label: t("dataFilter.checked"), value: true },
      ].map((option) => {
        const selected = value === option.value;

        return (
          <button
            key={String(option.value)}
            className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            type="button"
            onClick={() => {
              onChange(option.value);
            }}
          >
            <span className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
              {option.label}
            </span>
            <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
              {selected && <CheckIcon />}
            </span>
          </button>
        );
      })}
    </div>
  );
};
