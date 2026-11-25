"use client";

import { Toaster, toast } from "@/components/ui/toast";
import type { ComponentProps, FC } from "react";

export type ToastProviderProps = ComponentProps<typeof Toaster>;

export const ToastProvider: FC<ToastProviderProps> = ({
  children,
  ...props
}) => {
  return <Toaster {...props}>{children}</Toaster>;
};

export { toast };
