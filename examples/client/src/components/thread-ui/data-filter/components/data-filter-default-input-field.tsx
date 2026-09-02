import { useState } from "react";
import type { FC } from "react";

import type { DataFilterItemInputProps } from "../types";
import { Input } from "@/components/ui/input";

interface DataFilterDefaultInputFieldProps {
  item: DataFilterItemInputProps;
  value?: string;
  onChange: (value: string | undefined) => void;
}

const getDraftValue = (value: unknown) => {
  return typeof value === "string" ? value : "";
};

const getCommittedValue = (value: string) => {
  return value || undefined;
};

interface InputDraftState {
  sourceValue: string;
  value: string;
}

const createInputDraftState = (value: unknown): InputDraftState => {
  const draftValue = getDraftValue(value);

  return {
    sourceValue: draftValue,
    value: draftValue,
  };
};

export const DataFilterDefaultInputField: FC<
  DataFilterDefaultInputFieldProps
> = ({ item, value, onChange }) => {
  const [draftState, setDraftState] = useState(() =>
    createInputDraftState(value),
  );
  const currentValue = getDraftValue(value);
  const draftValue =
    draftState.sourceValue === currentValue ? draftState.value : currentValue;

  const commitValue = () => {
    const nextValue = getCommittedValue(draftValue);

    if (nextValue === getCommittedValue(currentValue)) {
      return;
    }

    setDraftState({
      sourceValue: draftValue,
      value: draftValue,
    });
    onChange(nextValue);
  };

  return (
    <div className="px-2 pb-2">
      <Input
        placeholder={item.placeholder}
        value={draftValue}
        onBlur={commitValue}
        onChange={(event) => {
          setDraftState({
            sourceValue: currentValue,
            value: event.target.value,
          });
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) {
            return;
          }

          event.preventDefault();
          commitValue();
        }}
      />
    </div>
  );
};
