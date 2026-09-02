import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { FC } from "react";
import type {
  DataFilterItemNumberInputProps,
  DataFilterNumberInputBetweenValue,
  DataFilterOperator,
} from "../types";
import { NumberInput } from "@/components/thread-ui/number-input";

type DataFilterDefaultNumberInputFieldValue =
  | DataFilterNumberInputBetweenValue
  | number
  | undefined;

interface DataFilterDefaultNumberInputFieldProps {
  item: DataFilterItemNumberInputProps;
  operator: DataFilterOperator;
  value: DataFilterDefaultNumberInputFieldValue;
  onChange: (value: DataFilterDefaultNumberInputFieldValue) => void;
}

type NumberInputDraftValue = number | string;

interface NumberInputDraftState {
  committedValue: number | undefined;
  sourceValue: number | undefined;
  value: NumberInputDraftValue;
}

interface CommitNumberInputProps {
  ariaLabel?: string;
  item: DataFilterItemNumberInputProps;
  placeholder?: string;
  value?: number;
  onCommit: (value: number | undefined) => void;
}

const getDraftValue = (value: unknown): NumberInputDraftValue => {
  return typeof value === "number" ? value : "";
};

const getCommittedValue = (value: unknown) => {
  return typeof value === "number" ? value : undefined;
};

const createNumberInputDraftState = (value: unknown): NumberInputDraftState => {
  const committedValue = getCommittedValue(value);

  return {
    committedValue,
    sourceValue: committedValue,
    value: getDraftValue(value),
  };
};

const CommitNumberInput: FC<CommitNumberInputProps> = ({
  ariaLabel,
  item,
  placeholder,
  value,
  onCommit,
}) => {
  const [draftState, setDraftState] = useState(() =>
    createNumberInputDraftState(value),
  );
  const currentCommittedValue = getCommittedValue(value);
  const hasExternalValueChange = !Object.is(
    draftState.sourceValue,
    currentCommittedValue,
  );
  const draftValue = hasExternalValueChange
    ? getDraftValue(value)
    : draftState.value;
  const draftNumberValue = hasExternalValueChange
    ? currentCommittedValue
    : draftState.committedValue;

  const commitValue = () => {
    if (Object.is(draftNumberValue, currentCommittedValue)) {
      return;
    }

    setDraftState({
      committedValue: draftNumberValue,
      sourceValue: draftNumberValue,
      value: getDraftValue(draftNumberValue),
    });
    onCommit(draftNumberValue);
  };

  return (
    <NumberInput
      aria-label={ariaLabel}
      decimalScale={item.decimalScale}
      fixedDecimalScale={item.fixedDecimalScale}
      max={item.max}
      min={item.min}
      placeholder={placeholder}
      step={item.step}
      value={draftValue}
      onBlur={commitValue}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.nativeEvent.isComposing) {
          return;
        }

        event.preventDefault();
        commitValue();
      }}
      onValueChange={(values) => {
        setDraftState({
          committedValue: values.floatValue,
          sourceValue: currentCommittedValue,
          value: values.value,
        });
      }}
    />
  );
};

export const DataFilterDefaultNumberInputField: FC<
  DataFilterDefaultNumberInputFieldProps
> = ({ item, operator, value, onChange }) => {
  const { t } = useTranslation("thread-ui");

  if (operator === "$between") {
    const [min, max]: DataFilterNumberInputBetweenValue = Array.isArray(value)
      ? value
      : [value, undefined];

    return (
      <div className="grid gap-2 px-2 pb-2">
        <CommitNumberInput
          ariaLabel={t("dataFilter.minimumAriaLabel", { label: item.label })}
          item={item}
          value={min}
          onCommit={(nextMin) => {
            onChange([nextMin, max]);
          }}
        />

        <CommitNumberInput
          ariaLabel={t("dataFilter.maximumAriaLabel", { label: item.label })}
          item={item}
          value={max}
          onCommit={(nextMax) => {
            onChange([min, nextMax]);
          }}
        />
      </div>
    );
  }

  return (
    <div className="px-2 pb-2">
      <CommitNumberInput
        item={item}
        placeholder={item.placeholder}
        value={typeof value === "number" ? value : undefined}
        onCommit={onChange}
      />
    </div>
  );
};
