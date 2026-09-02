"use client";

import { NumericFormat } from "react-number-format";
import { forwardRef } from "react";
import type { ComponentProps } from "react";
import type { NumericFormatProps } from "react-number-format";

import { Input } from "@/components/ui/input";

export type NumberInputProps = Omit<
  NumericFormatProps,
  "customInput" | "getInputRef"
> &
  ComponentProps<"input">;

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (props, ref) => {
    return <NumericFormat customInput={Input} getInputRef={ref} {...props} />;
  },
);

NumberInput.displayName = "NumberInput";

export { NumberInput };
