"use client";

import type { ComponentProps, FC } from "react";

import { Toaster, toast } from "@/components/ui/toast";

export type ToastProviderProps = ComponentProps<typeof Toaster>;

export const ToastProvider: FC<ToastProviderProps> = ({
  children,
  ...props
}) => {
  return <Toaster {...props}>{children}</Toaster>;
};

export { toast };
